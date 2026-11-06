/**
 * Generation lifecycle phase ordering for in-flight initial website creation.
 * Higher number means later in the progressive generation pipeline.
 */
export const GENERATION_PHASE_ORDER = {
  pending: 0,
  generating: 1,
  validating: 2,
  repairing: 3,
  visual_verifying: 4,
  completed: 5,
  failed: 5,
};

/**
 * Reconciles local project state with incoming server polling or SSE data.
 * Protects against out-of-order network responses, stale polling results,
 * and regressive state updates.
 *
 * @param {object|null} prev - Current local project state in React.
 * @param {object|null} incoming - Fresh project data from poll or API response.
 * @returns {boolean} True if incoming data is stale and should be rejected; False if it should be accepted.
 */
export function isStaleProjectResponse(prev, incoming) {
  if (!prev || !incoming) return false;
  if (prev._id !== incoming._id) return false;

  const prevVersion = prev.version ?? 0;
  const incomingVersion = incoming.version ?? 0;

  // 1. Genuinely newer version: always accept (never stale)
  if (incomingVersion > prevVersion) {
    return false;
  }

  // 2. Older version: always reject as stale
  if (prevVersion > incomingVersion) {
    return true;
  }

  // 3. Same version: inspect status progression and terminal states
  const prevStatus = prev.status;
  const incomingStatus = incoming.status;

  // If local state is already terminal, any non-terminal incoming state is stale
  if (prevStatus === "completed" || prevStatus === "failed") {
    if (incomingStatus !== "completed" && incomingStatus !== "failed") {
      return true;
    }
  }

  // Generation lifecycle comparison within the same version
  const prevPhase = GENERATION_PHASE_ORDER[prevStatus];
  const incomingPhase = GENERATION_PHASE_ORDER[incomingStatus];

  if (prevPhase !== undefined && incomingPhase !== undefined) {
    // If incoming state is from an earlier phase, it is stale
    if (prevPhase > incomingPhase) {
      return true;
    }

    // If both are in the 'generating' phase, compare files generated count
    if (prevStatus === "generating" && incomingStatus === "generating") {
      const prevFileCount = Array.isArray(prev.filesGenerated) ? prev.filesGenerated.length : 0;
      const incomingFileCount = Array.isArray(incoming.filesGenerated) ? incoming.filesGenerated.length : 0;
      if (prevFileCount > incomingFileCount) {
        return true;
      }
    }
  }

  // If local state is 'revising', an incoming state of earlier generation phases for the same version is stale
  if (prevStatus === "revising") {
    if (incomingStatus === "pending" || incomingStatus === "generating" || incomingStatus === "validating" || incomingStatus === "repairing") {
      return true;
    }
  }

  return false;
}

/**
 * Reconciles incoming project data against current state, preserving
 * current state if incoming data is determined to be stale.
 *
 * @param {object|null} prev - Current local state.
 * @param {object|null} incoming - Incoming data.
 * @returns {object} The reconciled project state.
 */
export function reconcileProjectState(prev, incoming) {
  if (isStaleProjectResponse(prev, incoming)) {
    return prev;
  }
  return incoming;
}

