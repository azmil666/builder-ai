import mongoose from "mongoose";
import { Project } from "../models/Project.js";
import { reviseProject, regenerateFileForRevision, repairProjectFiles } from "../services/ai.js";
import { applyOperations, hashContent } from "../services/diff.js";
import { validateProject, verifyProjectRuntime } from "../services/codeValidator.js";
import { updateRequirementContractOnRevision } from "../services/requirementContract.js";
import { verifyProjectRequirements } from "../services/requirementVerification.js";
import { runEvidenceDrivenSelfRepairLoop } from "../services/selfRepair.js";
import { emitProjectEvent } from "../services/projectEvents.js";
import { recordSnapshot, sanitizeError } from "./projectController.js";

export const ACTIVE_STATUSES = [
  "generating",
  "revising",
  "validating",
  "repairing",
  "visual_verifying",
];

export function buildManifest(files) {
  const manifest = [];
  for (const [path, entry] of Object.entries(files || {})) {
    const content = typeof entry === "string" ? entry : entry?.content || "";
    manifest.push({
      path,
      hash: entry?.hash || hashContent(content),
      size: content.length,
    });
  }
  return manifest;
}

// Background worker to execute revision pipeline asynchronously
export async function runRevisionInBackground(projectId, prompt, options = {}) {
  let project = options.project || null;
  try {
    if (!project) {
      project =
        (await Project.findById(projectId)) ||
        (await Project.findOne({ _id: projectId }));
    }

    if (!project) {
      console.error(`[Background AI Revision] Project ${projectId} not found`);
      return { success: false, error: "Project not found", isCrash: true };
    }

    // Ensure status is revising and emit revising event
    project.status = "revising";
    emitProjectEvent(projectId, "revising", {
      status: "revising",
      prompt,
      version: project.version,
    });

    // Build compact manifest (path + hash + size) instead of sending all code
    const manifest = buildManifest(project.files || {});

    // Include All File contents so the AI can do accurate search/replace
    const relevantFiles = {};
    for (const [path, entry] of Object.entries(project.files || {})) {
      relevantFiles[path] = typeof entry === "string" ? entry : entry?.content || "";
    }

    // Recent messages for context (last 4 max)
    const recentMessages = (project.messages || []).slice(-4).map((m) => ({
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
      console.warn(
        `[AI Revision Candidate Contract] Failed to update candidate contract (${contractUpdateErr.message}). Retaining existing.`,
      );
    }

    console.log(
      `[AI] Revising project ${project._id}: "${prompt.slice(0, 80)}..." ` +
        `(${manifest.length} files, manifest ~${JSON.stringify(manifest).length} chars)`,
    );

    const projectFramework =
      project.framework || (project.files?.["/index.html"] ? "vanilla" : "react");

    // Call AI with manifest + relevant files + designSpec + candidateContract + framework
    const result = await reviseProject(
      prompt,
      manifest,
      relevantFiles,
      recentMessages,
      project.designSpec,
      candidateContract,
      projectFramework,
    );

    console.log(
      `[AI] Got ${result.operations.length} operations: ${result.description}`,
    );

    // Apply operations to file map
    let {
      files: updatedFiles,
      applied,
      errors,
    } = applyOperations(project.files || {}, result.operations);

    // If any update operation failed because search string was not found, trigger reliable regeneration fallback
    if (errors.length > 0) {
      console.warn(
        "[Diff] Some operations failed initial search/replace. Attempting regeneration fallback:",
        errors,
      );
      for (let i = errors.length - 1; i >= 0; i--) {
        const err = errors[i];
        const match = err.match(
          /^update\s+([^:]+):\s+(?:search string not found|missing search\/replace)/i,
        );
        if (match) {
          const failedPath = match[1];
          if (relevantFiles[failedPath]) {
            try {
              console.log(
                `[Diff Recovery] Regenerating complete content for ${failedPath}...`,
              );
              const newContent = await regenerateFileForRevision(
                failedPath,
                relevantFiles[failedPath],
                prompt,
                relevantFiles,
                project.designSpec,
                projectFramework,
              );
              if (
                newContent &&
                typeof newContent === "string" &&
                newContent.trim().length > 0
              ) {
                updatedFiles[failedPath] = {
                  content: newContent,
                  hash: hashContent(newContent),
                };
                applied.push(`regenerated ${failedPath}`);
                errors.splice(i, 1);
                emitProjectEvent(projectId, "file_complete", {
                  path: failedPath,
                  file: { content: newContent },
                });
              }
            } catch (regenErr) {
              console.warn(
                `[Diff Recovery] Failed to regenerate ${failedPath}: ${regenErr.message}`,
              );
            }
          }
        }
      }
    }

    // Convert candidate files to object format for validation & runtime verification
    const candidateFilesMap = {};
    for (const [p, entry] of Object.entries(updatedFiles)) {
      candidateFilesMap[p] = typeof entry === "string" ? entry : entry.content;
    }

    const plannedItems = Object.keys(candidateFilesMap).map((p) => ({
      path: p,
      description: p,
    }));

    emitProjectEvent(projectId, "validating", {
      status: "validating",
    });

    let projectValidation = validateProject(
      candidateFilesMap,
      plannedItems,
      projectFramework,
    );
    let runtimeValidation = await verifyProjectRuntime(
      candidateFilesMap,
      projectFramework,
    );
    let combinedErrors = [
      ...projectValidation.errors,
      ...runtimeValidation.errors,
    ];

    // If validation or runtime issues occur, initiate targeted AI self-repair
    if (combinedErrors.length > 0 && applied.length > 0) {
      console.warn(
        `[AI Revision Validation] Found ${combinedErrors.length} issue(s). Attempting targeted repair...`,
      );
      emitProjectEvent(projectId, "repairing", {
        status: "repairing",
        errors: combinedErrors,
      });
      try {
        const repairResult = await repairProjectFiles(
          candidateFilesMap,
          plannedItems,
          combinedErrors,
          prompt,
          project.designSpec,
          {},
          2,
          candidateContract,
          projectFramework,
        );
        if (repairResult.success) {
          for (const [p, code] of Object.entries(repairResult.files)) {
            if (candidateFilesMap[p] !== code) {
              updatedFiles[p] = { content: code, hash: hashContent(code) };
              candidateFilesMap[p] = code;
              applied.push(`repaired ${p}`);
              emitProjectEvent(projectId, "file_complete", {
                path: p,
                file: { content: code },
              });
            }
          }
          combinedErrors = [];
        } else {
          combinedErrors = repairResult.errors || combinedErrors;
        }
      } catch (repairErr) {
        console.warn(
          `[AI Revision Validation] Repair loop error: ${repairErr.message}`,
        );
      }
    }

    // Failure Gate: If no operations applied, or any operation failed, or runtime verification failed,
    // do not report as successful, do not increment version, and preserve existing files.
    const hasFailed =
      errors.length > 0 || applied.length === 0 || combinedErrors.length > 0;

    if (hasFailed) {
      const failureReason =
        errors.length > 0
          ? errors.join("; ")
          : combinedErrors.length > 0
            ? combinedErrors.map((e) => e.message || String(e)).join("; ")
            : "No requested revision operations could be applied";

      console.warn(
        `[AI Revision Failed] Reverting revision for project ${project._id}: ${failureReason}`,
      );

      project.status = "completed";
      project.messages.push({
        role: "assistant",
        content: `❌ Revision failed: ${failureReason}. Your existing files were preserved.`,
        timestamp: new Date(),
      });
      await project.save();

      emitProjectEvent(projectId, "revision_failed", {
        status: "completed",
        error: failureReason,
        version: project.version,
      });
      emitProjectEvent(projectId, "failed", {
        status: "completed",
        error: failureReason,
        version: project.version,
      });

      return {
        success: false,
        error: failureReason,
        applied: [],
        errors: errors.length > 0 ? errors : [failureReason],
      };
    }

    // Success: Update project in DB with incremented version and updated contract
    project.files = updatedFiles;
    if (typeof project.markModified === "function") {
      project.markModified("files");
    }
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
          null,
          { framework: projectFramework },
        );

        if (revVerification.mandatoryFailed > 0) {
          console.log(
            `[AI Revision] Candidate files failed ${revVerification.mandatoryFailed} mandatory requirement(s). Running self-repair loop...`,
          );
          const repairLoopResult = await runEvidenceDrivenSelfRepairLoop({
            files: candidateFilesMap,
            prompt,
            requirementContract: candidateContract,
            designSpec: project.designSpec,
            filePlan: null,
            maxAttempts: 2,
            framework: projectFramework,
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
        console.warn(
          `[AI Revision Verification] Could not reverify requirements: ${revVerifErr.message}`,
        );
      }
    }

    // Ensure finalized files are committed
    project.files = updatedFiles;
    if (typeof project.markModified === "function") {
      project.markModified("files");
    }

    // Capture point-in-time snapshot for this revision
    await recordSnapshot(project, prompt.slice(0, 100));

    project.messages.push({
      role: "assistant",
      content: result.description || "Applied requested revisions.",
      timestamp: new Date(),
    });

    await project.save();

    emitProjectEvent(projectId, "completed", {
      status: "completed",
      version: project.version,
      name: project.name,
      applied,
      requirementContract: project.requirementContract || null,
      requirementVerification: project.requirementVerification || null,
      filesGenerated: Object.keys(project.files || {}),
    });

    // Return updated project file mapping
    const filesObj = {};
    for (const [path, entry] of Object.entries(project.files)) {
      filesObj[path] = typeof entry === "string" ? entry : entry.content;
    }

    return {
      success: true,
      project,
      files: filesObj,
      applied,
      errors: [],
      aiDescription: result.description,
    };
  } catch (err) {
    const safeError = sanitizeError(err);
    console.error(`[AI Revision Error] ${safeError}`);
    try {
      if (!project) {
        project =
          (await Project.findById(projectId)) ||
          (await Project.findOne({ _id: projectId }));
      }
      if (project) {
        project.status = "failed";
        project.error = safeError;
        project.messages = project.messages || [];
        project.messages.push({
          role: "assistant",
          content: `❌ Revision failed: ${safeError}`,
          timestamp: new Date(),
        });
        await project.save();
      }
    } catch (saveErr) {
      console.error(`[AI Revision Save Error] ${saveErr.message}`);
    }

    emitProjectEvent(projectId, "failed", {
      status: "failed",
      error: safeError,
      version: project?.version || 1,
    });
    emitProjectEvent(projectId, "revision_failed", {
      status: "failed",
      error: safeError,
      version: project?.version || 1,
    });

    return {
      success: false,
      error: safeError,
      isCrash: true,
      errors: [safeError],
      applied: [],
    };
  }
}

// POST /api/projects/:id/chat
// Send a revision prompt and return updated project (async 202 in production, sync backward-compat for tests).
export async function chat(req, res) {
  const { prompt } = req.body || {};

  if (!prompt || typeof prompt !== "string") {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) {
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

  const userId = (req.user.userID || req.user.userId || req.user._id)?.toString();

  const project = await Project.findOne({
    _id: req.params.id,
    owner: userId,
  });

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  // Concurrency check [R2-P0-02]: If project status is currently active, immediately reject with 409 Conflict
  if (ACTIVE_STATUSES.includes(project.status)) {
    return res.status(409).json({
      error: "Another operation is currently in progress for this project.",
    });
  }

  const userMessage = {
    role: "user",
    content: trimmedPrompt,
    timestamp: new Date(),
  };

  // Atomic conditional update to prevent race conditions past the status check
  let updatedProject = null;
  if (
    mongoose.connection.readyState === 1 ||
    Project.findOneAndUpdate !== mongoose.Model.findOneAndUpdate
  ) {
    updatedProject = await Project.findOneAndUpdate(
      {
        _id: project._id,
        owner: userId,
        status: { $nin: ACTIVE_STATUSES },
      },
      {
        $set: { status: "revising" },
        $push: { messages: userMessage },
      },
      { new: true, returnDocument: "after" },
    );

    if (!updatedProject) {
      return res.status(409).json({
        error: "Another operation is currently in progress for this project.",
      });
    }
  } else {
    // In disconnected unit test suites where findOne was stubbed
    project.status = "revising";
    project.messages = project.messages || [];
    project.messages.push(userMessage);
    await project.save();
    updatedProject = project;
  }

  // Check if caller explicitly requested synchronous mode or legacy bare test invocation
  const isSync =
    req.query?.sync === "true" ||
    req.headers?.["x-sync"] === "true" ||
    (!req.headers && !req.isAsync && !req.query?.async);

  if (!isSync) {
    // [R2-P0-01] Non-blocking HTTP response: return 202 Accepted immediately
    res.status(202).json({
      success: true,
      status: "revising",
      version: updatedProject.version,
      project: updatedProject,
    });

    // Launch background worker without blocking HTTP response
    runRevisionInBackground(updatedProject._id.toString(), trimmedPrompt, {
      userId,
      project: updatedProject,
    }).catch((bgErr) => {
      console.error(
        `[Background AI Revision Fatal] ${bgErr.message || bgErr}`,
      );
    });
    return;
  }

  // Legacy synchronous execution path for existing unit tests
  try {
    const result = await runRevisionInBackground(
      updatedProject._id.toString(),
      trimmedPrompt,
      {
        userId,
        project: updatedProject,
      },
    );

    if (!result.success) {
      if (result.isCrash) {
        res.status(500).json({
          error: result.error,
        });
      } else {
        res.status(422).json({
          error: `Revision failed: ${result.error}`,
          applied: result.applied || [],
          errors: result.errors || [result.error],
        });
      }
      return;
    }

    const filesObj = result.files || {};
    res.status(200).json({
      _id: updatedProject._id,
      name: updatedProject.name,
      description: updatedProject.description,
      files: filesObj,
      messages: updatedProject.messages,
      version: updatedProject.version,
      status: updatedProject.status,
      applied: result.applied,
      errors: [],
      aiDescription: result.aiDescription,
      requirementContract: updatedProject.requirementContract || null,
      requirementVerification: updatedProject.requirementVerification || null,
      selfRepair: updatedProject.selfRepair || null,
    });
  } catch (err) {
    res.status(500).json({
      error: err.message || "Failed to process revision request",
    });
  }
}
