import mongoose from "mongoose";
import { Project } from "../models/Project.js";
import crypto from "crypto";
import { generateProject } from "../services/ai.js";
import { emitProjectEvent, formatSSE, subscribeProjectEvents } from "../services/projectEvents.js";
import { analyzeProjectVisualQuality, buildVisualQAFixPrompt } from "../services/visualQa.js";

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
    error: project.error,
    createdAt: project.createdAt,
  });
}

// Background worker to progressive generate files and update database in real-time.
async function runBackgroundGeneration(projectId, prompt) {
  try {
    console.log(`[Background AI] Starting generation for project ${projectId}`);
    const result = await generateProject(prompt, {
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
    });

    console.log(`[Background AI] Successfully generated project ${projectId}`);

    const project = await Project.findById(projectId);
    if (project) {
      project.status = "completed";
      project.version = 1;
      if (result.description) {
        project.name = result.description;
      }
      if (result.designSpec) {
        project.designSpec = result.designSpec;
      }
      project.messages.push({
        role: "assistant",
        content: `Website generation complete! You can view and edit the files.`,
        timestamp: new Date(),
      });
      await project.save();

      emitProjectEvent(projectId, "completed", {
        status: "completed",
        version: project.version,
        name: project.name,
        designSpec: project.designSpec,
        filesGenerated: project.filesGenerated,
      });
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
