import mongoose from "mongoose";
import { Project } from "../models/Project.js";
import crypto from "crypto";
import { generateProject } from "../services/ai.js";
import { emitProjectEvent, formatSSE, subscribeProjectEvents } from "../services/projectEvents.js";
import {
  analyzeProjectVisualQuality,
  buildVisualQAFixPrompt,
  evaluateViewportRender,
  aggregateVisualVerificationResults,
  performTargetedVisualRepair,
  VERIFICATION_VIEWPORTS,
} from "../services/visualQa.js";

export const pendingVisualVerifications = new Map();

function hashContent(content) {
  return crypto.createHash("md5").update(content).digest("hex").slice(0, 12);
}

export function sanitizeError(error) {
  if (!error) return "Unknown error";
  const str = typeof error === "string" ? error : error.message || String(error);
  return str
    .replace(/Bearer\s+[a-zA-Z0-9_\.\-]+/gi, "Bearer [REDACTED_TOKEN]")
    .replace(/sk-[a-zA-Z0-9_\-]+/g, "[REDACTED_API_KEY]")
    .replace(/AIza[0-9A-Za-z\-_]{35}/g, "[REDACTED_GEMINI_KEY]")
    .replace(/mongodb(\+srv)?:\/\/[^@]+@/gi, "mongodb$1://[REDACTED_AUTH]@");
}

// POST /api/projects
// Create a new project from an AI prompt .
export async function createProject(req, res) {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== "string") {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const userId = req.user.userID || req.user.userId;

  // Create project in DB immediately with "pending" status
  const project = await Project.create({
    name: "Planning project...",
    description: prompt,
    files: {},
    messages: [
      { role: "user", content: prompt },
      { role: "assistant", content: "Planning project structure..." },
    ],
    version: 0,
    owner: userId,
    status: "pending",
    filesPlanned: [],
    filesGenerated: [],
    currentFile: null,
    CurrentFile: null,
    designSpec: null,
    requirementContract: null,
    requirementVerification: null,
    error: null,
  });

  // Start background generation
  runBackgroundGeneration(project._id.toString(), prompt).catch((err) => {
    const safeError = sanitizeError(err);
    console.error(
      `[Background AI] Fatal generation error for project ${project._id}: ${safeError}`,
    );
  });

  res.status(201).json({
    _id: project._id,
    name: project.name,
    description: project.description,
    files: {},
    messages: project.messages,
    version: project.version,
    status: project.status,
    filesPlanned: project.filesPlanned,
    filesGenerated: project.filesGenerated,
    currentFile: project.currentFile ?? project.CurrentFile ?? null,
    designSpec: project.designSpec || null,
    requirementContract: project.requirementContract || null,
    requirementVerification: project.requirementVerification || null,
    visualVerification: project.visualVerification || null,
    error: project.error,
    createdAt: project.createdAt,
  });
}

// Background worker to progressive generate files and update database in real-time.
async function runBackgroundGeneration(projectId, prompt) {
  try {
    console.log(`[Background AI] Starting generation for project ${projectId}`);
    const result = await generateProject(prompt, {
      onRequirementContract: async (contract) => {
        console.log(
          `[Background AI] Requirement Contract established for project ${projectId}: category="${contract.identity?.category}", mandatory=${contract.mandatoryRequirements?.length}`,
        );
        await Project.findByIdAndUpdate(projectId, {
          requirementContract: contract,
          $push: {
            messages: {
              role: "assistant",
              content: `Requirement contract established: **${contract.identity?.name || "Project"}** (${contract.identity?.category || "general"}) with ${contract.mandatoryRequirements?.length || 0} mandatory requirement(s).`,
              timestamp: new Date(),
            },
          },
        });
        emitProjectEvent(projectId, "requirement_contract", {
          requirementContract: contract,
        });
      },
      onDesignSpec: async (spec) => {
        console.log(
          `[Background AI] DesignSpec established for project ${projectId}: archetype="${spec.archetype}", aesthetic="${spec.aestheticDirection}"`,
        );
        await Project.findByIdAndUpdate(projectId, {
          designSpec: spec,
          $push: {
            messages: {
              role: "assistant",
              content: `Design concept established: **${spec.aestheticDirection}** (${spec.archetype} archetype) with palette (${spec.colorPalette?.primary}, ${spec.colorPalette?.accent}).`,
              timestamp: new Date(),
            },
          },
        });
        emitProjectEvent(projectId, "design_spec", {
          designSpec: spec,
        });
      },
      onPlan: async (plan) => {
        console.log(
          `[Background AI] Plan created for project ${projectId}. Planned ${plan.files.length} files.`,
        );
        const fileList = plan.files
          .map((f) => `- \`${f.path}\`: ${f.description}`)
          .join("\n");

        await Project.findByIdAndUpdate(projectId, {
          name: plan.projectName || "Generated Project",
          status: "generating",
          filesPlanned: plan.files,
          $push: {
            messages: {
              role: "assistant",
              content: `Planned website structure:\n${fileList}`,
              timestamp: new Date(),
            },
          },
        });
        emitProjectEvent(projectId, "plan", {
          status: "generating",
          name: plan.projectName || "Generated Project",
          filesPlanned: plan.files,
        });
      },
      onFileStart: async (path) => {
        console.log(
          `[Background AI] Starting file ${path} for project ${projectId}`,
        );
        await Project.findByIdAndUpdate(projectId, {
          currentFile: path,
          CurrentFile: path,
        });
        emitProjectEvent(projectId, "file_start", {
          currentFile: path,
        });
      },
      onFileComplete: async (path, code) => {
        console.log(
          `[Background AI] Finished file ${path} for project ${projectId}`,
        );

        const project = await Project.findById(projectId);

        if (project) {
          project.files = project.files || {};
          project.files[path] = {
            content: code,
            hash: hashContent(code),
          };

          project.filesGenerated = [...(project.filesGenerated || []), path];
          project.messages.push({
            role: "assistant",
            content: `Created file "${path}"`,
            timestamp: new Date(),
          });
          project.currentFile = null;
          project.CurrentFile = null;
          project.markModified("files");
          await project.save();

          emitProjectEvent(projectId, "file_complete", {
            path,
            filesGenerated: project.filesGenerated,
            currentFile: null,
            file: { content: code },
          });
        }
      },
      onValidationStart: async () => {
        console.log(`[Background AI] Starting semantic validation for project ${projectId}`);
        await Project.findByIdAndUpdate(projectId, {
          status: "validating",
          currentFile: null,
          CurrentFile: null,
          $push: {
            messages: {
              role: "assistant",
              content: "Validating code syntax, imports, exports, and component contracts...",
              timestamp: new Date(),
            },
          },
        });
        emitProjectEvent(projectId, "validating", {
          status: "validating",
        });
      },
      onRepairStart: async (errors) => {
        console.log(`[Background AI] Starting targeted repair loop for project ${projectId} (${errors.length} errors)`);
        await Project.findByIdAndUpdate(projectId, {
          status: "repairing",
          $push: {
            messages: {
              role: "assistant",
              content: `Identified ${errors.length} code issue(s). Initiating AI self-repair...`,
              timestamp: new Date(),
            },
          },
        });
        emitProjectEvent(projectId, "repairing", {
          status: "repairing",
          errors,
        });
      },
      onRequirementVerification: async (verification) => {
        console.log(
          `[Background AI] Requirement verification completed for project ${projectId}: overallStatus=${verification.overallStatus}, passed=${verification.passed}/${verification.totalRequirements}`,
        );
        emitProjectEvent(projectId, "requirement_verification", {
          requirementVerification: verification,
        });
      },
    });

    console.log(`[Background AI] Successfully generated project ${projectId}`);

    const project = await Project.findById(projectId);
    if (project) {
      project.version = 1;
      if (result.description) {
        project.name = result.description;
      }
      if (result.designSpec) {
        project.designSpec = result.designSpec;
      }
      if (result.requirementContract) {
        project.requirementContract = result.requirementContract;
      }
      if (result.requirementVerification) {
        project.requirementVerification = result.requirementVerification;
      }

      // Enter Visual Verification stage
      console.log(`[Background AI] Entering visual layout verification for project ${projectId}`);
      project.status = "visual_verifying";
      const initialVerification = {
        status: "verifying",
        timestamp: new Date().toISOString(),
        viewports: {
          desktop: { viewport: { name: "desktop", width: 1440, height: 900 }, passed: null, issues: [] },
          mobile: { viewport: { name: "mobile", width: 375, height: 812 }, passed: null, issues: [] },
        },
        issues: [],
        repairAttempted: false,
      };
      project.visualVerification = initialVerification;
      project.messages.push({
        role: "assistant",
        content: `Code generation and semantic validation complete. Starting visual layout verification on desktop (1440×900) and mobile (375×812) viewports...`,
        timestamp: new Date(),
      });
      await project.save();

      emitProjectEvent(projectId, "visual_verifying", {
        status: "visual_verifying",
        visualVerification: initialVerification,
        version: project.version,
        name: project.name,
        designSpec: project.designSpec,
        filesGenerated: project.filesGenerated,
      });

      // Wait for visual verification reporting from client preview runtime
      await waitForClientVisualVerification(projectId, project);
    }
  } catch (err) {
    const safeError = sanitizeError(err);
    console.error(
      `[Background AI] Fatal generation error for project ${projectId}: ${safeError}`,
    );

    await Project.findByIdAndUpdate(projectId, {
      status: "failed",
      error: safeError,
      $push: {
        messages: {
          role: "assistant",
          content: `❌ Generation failed: ${safeError}`,
          timestamp: new Date(),
        },
      },
    });

    emitProjectEvent(projectId, "failed", {
      status: "failed",
      error: safeError,
    });
  }
}

/**
 * Awaits visual verification results from the client browser preview runtime.
 * If the preview runtime does not report within the safe timeout (or if disconnected),
 * gracefully transitions project to completed with visualVerification marked as skipped.
 */
export async function waitForClientVisualVerification(projectId, project) {
  const timeoutMs = parseInt(
    process.env.VISUAL_VERIFICATION_TIMEOUT_MS ||
      (process.env.NODE_ENV === "test" ? "300" : "15000"),
    10,
  );

  let resolveVerification;
  const verifyPromise = new Promise((resolve) => {
    resolveVerification = resolve;
    pendingVisualVerifications.set(projectId.toString(), resolve);
  });

  const timer = setTimeout(() => {
    resolveVerification({ timedOut: true });
  }, timeoutMs);

  const outcome = await verifyPromise;
  clearTimeout(timer);
  pendingVisualVerifications.delete(projectId.toString());

  if (outcome?.timedOut) {
    const updated = await Project.findById(projectId);
    if (updated && updated.status === "visual_verifying") {
      updated.status = "completed";
      updated.visualVerification = {
        status: "skipped",
        reason: "Visual verification skipped: client preview runtime was not connected within timeout",
        timestamp: new Date().toISOString(),
        viewports: {
          desktop: { viewport: { name: "desktop", width: 1440, height: 900 }, passed: null, issues: [] },
          mobile: { viewport: { name: "mobile", width: 375, height: 812 }, passed: null, issues: [] },
        },
        issues: [],
        repairAttempted: false,
      };
      updated.messages.push({
        role: "assistant",
        content: "Website generation complete. (Visual preview verification skipped: preview runtime was not available).",
        timestamp: new Date(),
      });
      await updated.save();

      emitProjectEvent(projectId, "completed", {
        status: "completed",
        version: updated.version,
        name: updated.name,
        designSpec: updated.designSpec,
        filesGenerated: updated.filesGenerated,
        visualVerification: updated.visualVerification,
      });
    }
  }
}

// GET /api/projects
// List all projects owned by the user (summary only, no file contents).
export async function listProjects(req, res) {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const userId = req.user.userID || req.user.userId;

  const projects = await Project.find(
    { owner: userId },
    {
      name: 1,
      description: 1,
      version: 1,
      status: 1,
      published: 1,
      designSpec: 1,
      createdAt: 1,
      updatedAt: 1,
    },
  ).sort({ updatedAt: -1 });

  res.json(projects);
}

// GET /api/projects/:id
// Get full project details.
export async function getProject(req, res) {
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

  const fileObj = {};
  for (const [path, entry] of Object.entries(project.files)) {
    fileObj[path] = entry.content;
  }

  res.json({
    _id: project._id,
    name: project.name,
    description: project.description,
    files: fileObj,
    messages: project.messages,
    version: project.version,
    status: project.status,
    filesPlanned: project.filesPlanned,
    filesGenerated: project.filesGenerated,
    currentFile: project.currentFile ?? project.CurrentFile ?? null,
    designSpec: project.designSpec || null,
    requirementContract: project.requirementContract || null,
    requirementVerification: project.requirementVerification || null,
    visualVerification: project.visualVerification || null,
    error: project.error,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  });
}

// DELETE /api/projects/:id
// Delete a project.
export async function deleteProject(req, res) {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const userId = req.user.userID || req.user.userId;

  const result = await Project.findOneAndDelete({
    _id: req.params.id,
    owner: userId,
  });

  if (!result) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json({ success: true });
}

// PUT /api/projects/:id/files
// Update project files (manual edits).
export async function updateProjectFiles(req, res) {
  const { files } = req.body;
  if (!files || typeof files !== "object") {
    res.status(400).json({ error: "files object is required" });
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

  // Rebuild project files map with content & hashes
  const newFiles = {};
  for (const [path, content] of Object.entries(files)) {
    if (typeof content === "string") {
      newFiles[path] = { content, hash: hashContent(content) };
    }
  }

  project.files = newFiles;
  await project.save();

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
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  });
}

// POST /api/projects/:id/publish
// Mark a project as publicly published.
export async function publishProject(req, res) {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const userId = req.user.userID || req.user.userId;

  const project = await Project.findOneAndUpdate(
    { _id: req.params.id, owner: userId },
    { published: true },
    { returnDocument: "after" },
  );

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json({ success: true, published: project.published });
}

// GET /api/projects/public/:id
// Get a publicly published project details (without auth).
export async function getPublicProject(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const project = await Project.findById(req.params.id);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  if (!project.published) {
    res.status(403).json({ error: "Project is not published yet" });
    return;
  }

  const filesObj = {};
  for (const [path, entry] of Object.entries(project.files)) {
    filesObj[path] = entry.content;
  }

  res.json({
    _id: project._id,
    name: project.name,
    description: project.description,
    files: filesObj,
    version: project.version,
  });
}

// GET /api/projects/:id/stream
// Stream real-time progress events for project generation and revisions via Server-Sent Events (SSE).
export async function streamProjectProgress(req, res) {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const userId = req.user.userID || req.user.userId;
  const project = await Project.findById(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  // Cross-user subscription protection: owner verification
  if (project.owner.toString() !== userId.toString()) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  // Set SSE Headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });

  // 1. Immediately send ground-truth state from database
  const initialState = {
    projectId: project._id,
    status: project.status,
    name: project.name,
    version: project.version,
    designSpec: project.designSpec,
    requirementContract: project.requirementContract || null,
    requirementVerification: project.requirementVerification || null,
    visualVerification: project.visualVerification || null,
    filesPlanned: project.filesPlanned || [],
    filesGenerated: project.filesGenerated || [],
    currentFile: project.currentFile,
    error: project.error,
  };
  res.write(formatSSE("initial_state", initialState));

  // 2. If already terminal (completed or failed), terminate stream immediately
  if (project.status === "completed" || project.status === "failed") {
    res.write(
      formatSSE(project.status, {
        status: project.status,
        error: project.error,
        version: project.version,
        name: project.name,
        designSpec: project.designSpec,
        visualVerification: project.visualVerification || null,
        filesGenerated: project.filesGenerated || [],
      }),
    );
    res.end();
    return;
  }

  // 3. Subscribe to real-time events for this project
  const unsubscribe = subscribeProjectEvents(project._id, ({ event, data }) => {
    try {
      res.write(formatSSE(event, data));
      if (event === "completed" || event === "failed") {
        res.end();
      }
    } catch {
      // Client disconnected
    }
  });

  // 4. Send keepalive heartbeat comment every 15 seconds
  const heartbeatTimer = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      clearInterval(heartbeatTimer);
    }
  }, 15000);

  // 5. Clean up on connection close
  req.on("close", () => {
    clearInterval(heartbeatTimer);
    unsubscribe();
  });
}

// GET /api/projects/:id/qa
// Run automated Visual QA inspection on a project's codebase
export async function getProjectVisualQA(req, res) {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const userId = req.user.userID || req.user.userId;
  const project = await Project.findById(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  if (project.owner.toString() !== userId.toString()) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const qaReport = analyzeProjectVisualQuality(project.files, project.designSpec);
  const fixPrompt = buildVisualQAFixPrompt(qaReport);

  res.json({
    projectId: project._id,
    projectName: project.name,
    qaReport,
    fixPrompt,
  });
}

// POST /api/projects/:id/visual-verification
// Receives rendered viewport metrics/errors, evaluates overflow and runtime defects,
// and triggers at most ONE targeted AI self-repair attempt before re-evaluating.
export async function handleVisualVerification(req, res) {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const userId = req.user.userID || req.user.userId;
  const project = await Project.findById(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  if (project.owner.toString() !== userId.toString()) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const {
    viewportResults = [],
    timedOut = false,
    infrastructureError = null,
  } = req.body;

  // Evaluate each viewport result
  const evaluatedViewports = (viewportResults || []).map((vr) =>
    evaluateViewportRender({
      viewport: vr.viewport,
      metrics: vr.metrics,
      errors: vr.errors,
      compilationError: vr.compilationError,
      timedOut: timedOut || vr.timedOut,
      infrastructureError: infrastructureError || vr.infrastructureError,
    }),
  );

  const aggregated = aggregateVisualVerificationResults(evaluatedViewports);

  // 1. Timeout or Infrastructure Error: MUST NEVER be labeled "passed" or "verified"
  if (timedOut || infrastructureError || aggregated.status === "unavailable") {
    aggregated.status = "unavailable";
    project.visualVerification = {
      ...aggregated,
      status: "unavailable",
      repairAttempted: Boolean(project.visualVerification?.repairAttempted),
      repairedFiles: project.visualVerification?.repairedFiles || [],
    };
    project.status = "completed";
    await project.save();

    emitProjectEvent(project._id, "completed", {
      status: "completed",
      visualVerification: project.visualVerification,
      filesGenerated: project.filesGenerated,
      version: project.version,
      name: project.name,
      designSpec: project.designSpec,
    });

    const resolver = pendingVisualVerifications.get(project._id.toString());
    if (resolver) resolver({ completed: true, status: "unavailable" });

    res.json({
      status: "unavailable",
      visualVerification: project.visualVerification,
      completed: true,
    });
    return;
  }

  // 2. Clean: passed visual verification!
  if (aggregated.passed) {
    const wasRepaired = Boolean(project.visualVerification?.repairAttempted);
    const finalStatus = wasRepaired ? "repaired" : "verified";
    project.visualVerification = {
      ...aggregated,
      status: finalStatus,
      repairAttempted: wasRepaired,
      repairedFiles: project.visualVerification?.repairedFiles || [],
    };
    project.status = "completed";
    project.messages.push({
      role: "assistant",
      content: wasRepaired
        ? `✅ Visual verification passed after targeted AI repair. Both desktop (1440×900) and mobile (375×812) viewports render cleanly with 0 overflow.`
        : `✅ Visual verification passed. Both desktop (1440×900) and mobile (375×812) viewports render cleanly with 0 overflow.`,
      timestamp: new Date(),
    });
    await project.save();

    emitProjectEvent(project._id, "completed", {
      status: "completed",
      visualVerification: project.visualVerification,
      filesGenerated: project.filesGenerated,
      version: project.version,
      name: project.name,
      designSpec: project.designSpec,
    });

    const resolver = pendingVisualVerifications.get(project._id.toString());
    if (resolver) resolver({ completed: true, status: finalStatus });

    res.json({
      status: finalStatus,
      visualVerification: project.visualVerification,
      completed: true,
    });
    return;
  }

  // 3. Defects detected! Check if repair was already attempted:
  const alreadyRepaired = Boolean(project.visualVerification?.repairAttempted);

  if (alreadyRepaired) {
    // Single retry cap: do not loop indefinitely! Retain best available project and clearly report remaining issues.
    project.visualVerification = {
      ...aggregated,
      status: "unresolved",
      repairAttempted: true,
      repairedFiles: project.visualVerification?.repairedFiles || [],
      remainingIssues: aggregated.issues,
    };
    project.status = "completed";
    project.messages.push({
      role: "assistant",
      content: `⚠️ Visual verification unresolved: ${aggregated.issues.length} issue(s) remaining after 1 targeted repair attempt. Retaining best available project.`,
      timestamp: new Date(),
    });
    await project.save();

    emitProjectEvent(project._id, "completed", {
      status: "completed",
      visualVerification: project.visualVerification,
      filesGenerated: project.filesGenerated,
      version: project.version,
      name: project.name,
      designSpec: project.designSpec,
    });

    const resolver = pendingVisualVerifications.get(project._id.toString());
    if (resolver) resolver({ completed: true, status: "unresolved" });

    res.json({
      status: "unresolved",
      visualVerification: project.visualVerification,
      completed: true,
    });
    return;
  }

  // 4. First time defects detected: execute ONE targeted AI self-repair attempt
  emitProjectEvent(project._id, "repairing", {
    status: "repairing",
    repairType: "visual",
    errors: aggregated.issues,
  });

  const rawFiles = {};
  for (const [p, entry] of Object.entries(project.files || {})) {
    rawFiles[p] = typeof entry === "string" ? entry : entry?.content || "";
  }

  const repairResult = await performTargetedVisualRepair({
    files: rawFiles,
    allPlannedFiles: project.filesPlanned || [],
    issues: aggregated.issues,
    prompt: project.description || project.name,
    designSpec: project.designSpec,
    callbacks: {
      onFileComplete: async (path, code) => {
        emitProjectEvent(project._id, "file_complete", {
          path,
          file: { content: code },
        });
      },
    },
  });

  const updatedFiles = {};
  for (const [p, c] of Object.entries(repairResult.files)) {
    updatedFiles[p] = { content: c, hash: hashContent(c) };
  }
  project.files = updatedFiles;
  project.markModified("files");

  project.visualVerification = {
    ...aggregated,
    status: "repairing",
    repairAttempted: true,
    repairedFiles: repairResult.repairedFiles,
    initialIssues: aggregated.issues,
  };
  project.messages.push({
    role: "assistant",
    content: `Targeted visual repair applied to: ${repairResult.repairedFiles.join(", ") || "layout files"}. Re-rendering viewports to verify...`,
    timestamp: new Date(),
  });
  await project.save();

  const plainFiles = {};
  for (const [p, entry] of Object.entries(project.files)) {
    plainFiles[p] = entry.content;
  }

  res.json({
    status: "repairing",
    needsReverification: true,
    visualVerification: project.visualVerification,
    repairedFiles: repairResult.repairedFiles,
    files: plainFiles,
  });
}
