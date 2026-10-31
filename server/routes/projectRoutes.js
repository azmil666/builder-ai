import { Router } from "express";
import {
  createProject,
  deleteProject,
  getProject,
  getProjectVisualQA,
  getPublicProject,
  listProjects,
  publishProject,
  streamProjectProgress,
  updateProjectFiles,
} from "../controllers/projectController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { chat } from "../controllers/chatController.js";
import {
  aiGenerationRateLimiter,
  aiRevisionRateLimiter,
} from "../middleware/rateLimiter.js";

const projectRouter = Router();

// Public Route
projectRouter.get("/public/:id", getPublicProject);

// Protect all following routes
projectRouter.use(authMiddleware);

projectRouter.post("/", aiGenerationRateLimiter, createProject);
projectRouter.get("/", listProjects);
projectRouter.get("/:id/stream", streamProjectProgress);
projectRouter.get("/:id/qa", getProjectVisualQA);
projectRouter.get("/:id", getProject);
projectRouter.delete("/:id", deleteProject);
projectRouter.put("/:id/files", updateProjectFiles);
projectRouter.post("/:id/publish", publishProject);

// Chat
projectRouter.post("/:id/chat", aiRevisionRateLimiter, chat);

export default projectRouter;