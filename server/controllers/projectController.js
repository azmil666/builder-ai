import { Project } from "../models/Project.js";
import crypto from "crypto";
import { generateProject } from "../services/ai.js";

function hashContent(content) {
  return crypto.createHash("md5").update(content).digest("hex").slice(0, 12);
}

function sanitizeError(error) {
  if (!error) return "Unknown error";
  const str = typeof error === "string" ? error : error.message || String(error);
  return str
    .replace(/Bearer\s+[a-zA-Z0-9_\.\-]+/gi, "Bearer [REDACTED_TOKEN]")
    .replace(/sk-[a-zA-Z0-9_\-]+/g, "[REDACTED_API_KEY]")
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
    owner: req.user.userID,
    status: "pending",
    filesPlanned: [],
    filesGenerated: [],
    currentFile: null,
    CurrentFile: null,
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
    error: project.error,
    createdAt: project.createdAt,
  });
}

// Background worker to progressive generate files and update database in real-time.
async function runBackgroundGeneration(projectId, prompt) {
  try {
    console.log(`[Background AI] Starting generation for project ${projectId}`);
    const result = await generateProject(prompt, {
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
      },
      onFileStart: async (path) => {
        console.log(
          `[Background AI] Starting file ${path} for project ${projectId}`,
        );
        await Project.findByIdAndUpdate(projectId, {
          currentFile: path,
          CurrentFile: path,
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
        }
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
      project.messages.push({
        role: "assistant",
        content: `Website generation complete! You can view and edit the files.`,
        timestamp: new Date(),
      });
      await project.save();
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
  }
}

// GET /api/projects
// List all projects owned by the user (summary only, no file contents).
export async function listProjects(req, res) {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const projects = await Project.find(
    { owner: req.user.userID },
    { name: 1, description: 1, version: 1, createdAt: 1, updatedAt: 1 },
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

  const project = await Project.findOne({
    _id: req.params.id,
    owner: req.user.userID,
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

  const result = await Project.findOneAndDelete({
    _id: req.params.id,
    owner: req.user.userID,
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

  const project = await Project.findOne({
    _id: req.params.id,
    owner: req.user.userID,
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

  const project = await Project.findOneAndUpdate(
    { _id: req.params.id, owner: req.user.userID },
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