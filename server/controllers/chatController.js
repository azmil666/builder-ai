import mongoose from "mongoose";
import { Project } from "../models/Project.js";
import { reviseProject, regenerateFileForRevision, repairProjectFiles } from "../services/ai.js";
import { applyOperations, hashContent } from "../services/diff.js";
import { validateProject, verifyProjectRuntime } from "../services/codeValidator.js";
import { updateRequirementContractOnRevision } from "../services/requirementContract.js";
import { verifyProjectRequirements } from "../services/requirementVerification.js";
import { runEvidenceDrivenSelfRepairLoop } from "../services/selfRepair.js";

export function buildManifest(files) {
  const manifest = [];
  for (const [path, entry] of Object.entries(files)) {
    manifest.push({ path, hash: entry.hash, size: entry.content.length });
  }
  return manifest;
}

// POST /api/projects/:id/chat
// Send a revision prompt and return upadted project.
export async function chat(req, res) {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== "string") {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const userId = req.user.userID || req.user.userId;

  const project = await Project.findOne({
    _id: req.params.id,
    owner: userId,
  });

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  // Set status to revising and save user prompt immediately
  project.status = "revising";
  project.messages.push({
    role: "user",
    content: prompt,
    timestamp: new Date(),
  });
  await project.save();

  try {
    // Build compact manifest (path + hash + size) instead of sending all code
    const manifest = buildManifest(project.files);

    // Include All File contents so the AI can do accurate search/replace
    const relevantFiles = {};
    for (const [path, entry] of Object.entries(project.files)) {
      relevantFiles[path] = entry.content;
    }

    // Recent messages for context (last 4 max)
    const recentMessages = project.messages.slice(-4).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Stage candidate requirement contract in memory BEFORE revision generation
    // so the AI receives the updated requirements reflecting the user's latest revision instruction.
    // The database contract remains untouched until revision and validation succeed.
    let candidateContract = project.requirementContract;
    try {
      candidateContract = updateRequirementContractOnRevision(
        project.requirementContract,
        prompt,
        project.designSpec,
      );
    } catch (contractUpdateErr) {
      console.warn(`[AI Revision Candidate Contract] Failed to update candidate contract (${contractUpdateErr.message}). Retaining existing.`);
    }

    console.log(
      `[AI] Revising project ${project._id}: "${prompt.slice(0, 80)}..." ` +
        `(${manifest.length} files, manifest ~${JSON.stringify(manifest).length} chars)`,
    );

    // Call AI with manifest + relevant files + designSpec + candidateContract
    const result = await reviseProject(
      prompt,
      manifest,
      relevantFiles,
      recentMessages,
      project.designSpec,
      candidateContract,
    );

    console.log(
      `[AI] Got ${result.operations.length} operations: ${result.description}`,
    );

    // Apply operations to file map
    let {
      files: updatedFiles,
      applied,
      errors,
    } = applyOperations(project.files, result.operations);

    // If any update operation failed because search string was not found, trigger reliable regeneration fallback
    if (errors.length > 0) {
      console.warn("[Diff] Some operations failed initial search/replace. Attempting regeneration fallback:", errors);
      for (let i = errors.length - 1; i >= 0; i--) {
        const err = errors[i];
        const match = err.match(/^update\s+([^:]+):\s+(?:search string not found|missing search\/replace)/i);
        if (match) {
          const failedPath = match[1];
          if (relevantFiles[failedPath]) {
            try {
              console.log(`[Diff Recovery] Regenerating complete content for ${failedPath}...`);
              const newContent = await regenerateFileForRevision(
                failedPath,
                relevantFiles[failedPath],
                prompt,
                relevantFiles,
                project.designSpec
              );
              if (newContent && typeof newContent === "string" && newContent.trim().length > 0) {
                updatedFiles[failedPath] = {
                  content: newContent,
                  hash: hashContent(newContent),
                };
                applied.push(`regenerated ${failedPath}`);
                errors.splice(i, 1);
              }
            } catch (regenErr) {
              console.warn(`[Diff Recovery] Failed to regenerate ${failedPath}: ${regenErr.message}`);
            }
          }
        }
      }
    }

    // Convert candidate files to object format for validation & runtime verification
    const candidateFilesMap = {};
    for (const [p, entry] of Object.entries(updatedFiles)) {
      candidateFilesMap[p] = entry.content;
    }

    const plannedItems = Object.keys(candidateFilesMap).map((p) => ({
      path: p,
      description: p,
    }));

    let projectValidation = validateProject(candidateFilesMap, plannedItems);
    let runtimeValidation = await verifyProjectRuntime(candidateFilesMap);
    let combinedErrors = [...projectValidation.errors, ...runtimeValidation.errors];

    // If validation or runtime issues occur, initiate targeted AI self-repair
    if (combinedErrors.length > 0 && applied.length > 0) {
      console.warn(`[AI Revision Validation] Found ${combinedErrors.length} issue(s). Attempting targeted repair...`);
      try {
        const repairResult = await repairProjectFiles(
          candidateFilesMap,
          plannedItems,
          combinedErrors,
          prompt,
          project.designSpec,
          {},
          2
        );
        if (repairResult.success) {
          for (const [p, code] of Object.entries(repairResult.files)) {
            if (candidateFilesMap[p] !== code) {
              updatedFiles[p] = { content: code, hash: hashContent(code) };
              candidateFilesMap[p] = code;
              applied.push(`repaired ${p}`);
            }
          }
          combinedErrors = [];
        } else {
          combinedErrors = repairResult.errors || combinedErrors;
        }
      } catch (repairErr) {
        console.warn(`[AI Revision Validation] Repair loop error: ${repairErr.message}`);
      }
    }

    // Failure Gate: If no operations applied, or any operation failed, or runtime verification failed,
    // do not report as successful, do not increment version, and preserve existing files.
    const hasFailed = errors.length > 0 || applied.length === 0 || combinedErrors.length > 0;

    if (hasFailed) {
      const failureReason =
        errors.length > 0
          ? errors.join("; ")
          : combinedErrors.length > 0
            ? combinedErrors.map((e) => e.message || String(e)).join("; ")
            : "No requested revision operations could be applied";

      console.warn(`[AI Revision Failed] Reverting revision for project ${project._id}: ${failureReason}`);

      project.status = "completed";
      project.messages.push({
        role: "assistant",
        content: `❌ Revision failed: ${failureReason}. Your existing files were preserved.`,
        timestamp: new Date(),
      });
      await project.save();

      res.status(422).json({
        error: `Revision failed: ${failureReason}`,
        applied: [],
        errors: errors.length > 0 ? errors : [failureReason],
      });
      return;
    }

    // Success: Update project in DB with incremented version and updated contract
    project.files = updatedFiles;
    project.markModified("files");
    project.version += 1;
    project.status = "completed";

    // Commit candidate contract now that generation, validation, and repair succeeded
    let selfRepairReport = null;
    if (candidateContract) {
      project.requirementContract = candidateContract;
      try {
        let revVerification = await verifyProjectRequirements(
          candidateFilesMap,
          candidateContract,
          null
        );

        if (revVerification.mandatoryFailed > 0) {
          console.log(`[AI Revision] Candidate files failed ${revVerification.mandatoryFailed} mandatory requirement(s). Running self-repair loop...`);
          const repairLoopResult = await runEvidenceDrivenSelfRepairLoop({
            files: candidateFilesMap,
            prompt,
            requirementContract: candidateContract,
            designSpec: project.designSpec,
            filePlan: null,
            maxAttempts: 2,
          });

          if (repairLoopResult.success) {
            for (const [p, code] of Object.entries(repairLoopResult.files)) {
              if (candidateFilesMap[p] !== code) {
                updatedFiles[p] = { content: code, hash: hashContent(code) };
                candidateFilesMap[p] = code;
                applied.push(`repaired ${p}`);
              }
            }
            revVerification = repairLoopResult.verification;
          }
          selfRepairReport = repairLoopResult.report;
        }

        project.requirementVerification = revVerification;
        if (selfRepairReport) {
          project.selfRepair = selfRepairReport;
        }
      } catch (revVerifErr) {
        console.warn(`[AI Revision Verification] Could not reverify requirements: ${revVerifErr.message}`);
      }
    }

    project.messages.push({
      role: "assistant",
      content: result.description || "Applied requested revisions.",
      timestamp: new Date(),
    });

    await project.save();

    // Return updated project
    const filesObj = {};

    for (const [path, entry] of Object.entries(project.files)) {
      filesObj[path] = entry.content;
    }

    res.json({
      _id: project._id,
      name: project.name,
      description: project.description,
      files: filesObj,
      messages: project.messages,
      version: project.version,
      status: project.status,
      applied,
      errors: [],
      aiDescription: result.description,
      requirementContract: project.requirementContract || null,
      requirementVerification: project.requirementVerification || null,
      selfRepair: project.selfRepair || null,
    });
  } catch (err) {
    console.error(`[AI Revision Error] ${err.message}`);
    try {
      project.status = "completed";
      await project.save();
    } catch (saveErr) {
      console.error(`[AI Revision Save Error] ${saveErr.message}`);
    }
    res.status(500).json({
      error: err.message || "Failed to process revision request",
    });
  }
}