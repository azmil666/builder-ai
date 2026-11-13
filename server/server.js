import express from "express";
import "dotenv/config";
import cors from "cors";
import cookieParser from "cookie-parser";
import { connectToDatabase } from "./config/db.js";
import { Project } from "./models/Project.js";
import { recoverOrphanedProjects } from "./services/recoveryService.js";
import { closeRedisClients } from "./config/redis.js";
import authRouter from "./routes/authRoutes.js";
import projectRouter from "./routes/projectRoutes.js";

// Validate mandatory environment variables before initializing the server
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length === 0) {
  console.error("[FATAL] Missing required environment variable: JWT_SECRET");
  process.exit(1);
}

const app = express();

await connectToDatabase();

// Clean up orphaned in-flight projects left behind if server restarted
try {
  const result = await recoverOrphanedProjects(Project);
  if (result.modifiedCount > 0) {
    console.log(`[Startup] Marked ${result.modifiedCount} orphaned project(s) as failed.`);
  }
} catch (cleanErr) {
  console.warn(`[Startup] Orphaned project cleanup notice: ${cleanErr.message}`);
}

const allowedOrigins = process.env.ORIGINS
  ? process.env.ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:3000"];

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(cookieParser())
app.use(express.json())

app.get("/", (req, res)=> res.send("Server is Live!"))
app.use('/api/auth', authRouter)
app.use('/api/projects', projectRouter)

// Centralized error handler
app.use((err, _req, res, _next) => {
  console.error(`[Error] ${err.message}`);
  const safeMessage =
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message;
  res.status(500).json({ error: safeMessage });
});

const port = process.env.PORT || 3000;

const server = app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  console.log(`[Shutdown] Received ${signal}, closing server and connections...`);
  server.close(async () => {
    try {
      await closeRedisClients();
    } catch (err) {
      console.warn(`[Shutdown] Redis cleanup notice: ${err.message}`);
    }
    process.exit(0);
  });
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
