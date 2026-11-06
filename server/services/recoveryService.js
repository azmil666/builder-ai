import { Project } from "../models/Project.js";

/**
 * All in-flight statuses that represent active, non-terminal work.
 * If the server restarts while a project is in any of these statuses,
 * the in-flight work has been severed and the project is orphaned.
 */
export const IN_FLIGHT_STATUSES = [
  "pending",
  "generating",
  "validating",
  "repairing",
  "revising",
  "visual_verifying",
];

export const RECOVERY_ERROR_MESSAGE =
  "Generation was interrupted by a server restart. Please try again.";

export const RECOVERY_ASSISTANT_MESSAGE =
  "❌ Generation was interrupted by a server restart. Please try creating or regenerating the project.";

/**
 * Recovers orphaned in-flight projects left behind after a server crash or restart.
 * Updates all non-terminal projects to 'failed' with an explanatory message.
 * Idempotent: running multiple times produces 0 modifiedCount on subsequent runs.
 * Does not touch projects that are already 'completed' or 'failed'.
 *
 * @param {object} projectModel - Mongoose model (defaults to Project) for dependency injection.
 * @returns {Promise<{ matchedCount: number, modifiedCount: number }>}
 */
export async function recoverOrphanedProjects(projectModel = Project) {
  if (!projectModel || typeof projectModel.updateMany !== "function") {
    return { matchedCount: 0, modifiedCount: 0 };
  }

  const result = await projectModel.updateMany(
    { status: { $in: IN_FLIGHT_STATUSES } },
    {
      $set: {
        status: "failed",
        error: RECOVERY_ERROR_MESSAGE,
      },
      $push: {
        messages: {
          role: "assistant",
          content: RECOVERY_ASSISTANT_MESSAGE,
          timestamp: new Date(),
        },
      },
    }
  );

  return {
    matchedCount: result?.matchedCount ?? result?.n ?? 0,
    modifiedCount: result?.modifiedCount ?? result?.nModified ?? 0,
  };
}

