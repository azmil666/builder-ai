import { EventEmitter } from 'events';

// In-process event emitter for project generation & revision events
class ProjectEventEmitter extends EventEmitter {
  constructor() {
    super();
    // Allow up to 100 concurrent listeners per process
    this.setMaxListeners(100);
  }
}

export const projectEventBus = new ProjectEventEmitter();

export const MAX_BUFFER_SIZE = 50;
export const BUFFER_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Map of projectIdString -> { seq: number, buffer: Array<{ id, seq, event, data, timestamp }>, timer: NodeJS.Timeout | null }
const projectBuffers = new Map();

/**
 * Formats an SSE payload string according to the W3C EventSource specification.
 */
export function formatSSE(event, data, id = null) {
  let message = '';
  if (id !== null && id !== undefined) {
    message += `id: ${id}\n`;
  }
  if (event) {
    message += `event: ${event}\n`;
  }
  const payload = typeof data === 'string' ? data : JSON.stringify(data);
  message += `data: ${payload}\n\n`;
  return message;
}

/**
 * Emits an event for a specific project.
 * Assigns monotonic sequence ID and stores in the per-project bounded replay buffer.
 */
export function emitProjectEvent(projectId, event, data = {}) {
  if (!projectId) return null;
  const pid = projectId.toString();
  const channel = `project:${pid}`;

  let state = projectBuffers.get(pid);
  if (!state) {
    state = {
      seq: 0,
      buffer: [],
      timer: null,
    };
    projectBuffers.set(pid, state);
  }

  // Increment sequence monotonically
  state.seq += 1;
  const seq = state.seq;
  const id = `${pid}:${seq}`;
  const timestamp = new Date().toISOString();

  const eventPayload = { id, seq, event, data, timestamp };

  // Ring buffer: store at most MAX_BUFFER_SIZE events
  state.buffer.push(eventPayload);
  if (state.buffer.length > MAX_BUFFER_SIZE) {
    state.buffer.shift();
  }

  // Schedule or refresh TTL cleanup timer (using .unref() so Node test suites exit cleanly)
  if (state.timer) {
    clearTimeout(state.timer);
  }
  state.timer = setTimeout(() => {
    projectBuffers.delete(pid);
  }, BUFFER_TTL_MS);
  if (typeof state.timer.unref === 'function') {
    state.timer.unref();
  }

  projectEventBus.emit(channel, eventPayload);
  return eventPayload;
}

/**
 * Retrieves missed events for a project after lastEventId.
 * Returns array of missed events in chronological order, or null if malformed or evicted.
 */
export function getMissedProjectEvents(projectId, lastEventId) {
  if (!projectId || !lastEventId) {
    return null;
  }

  if (typeof lastEventId !== 'string') {
    return null;
  }

  const pid = projectId.toString();
  const prefix = `${pid}:`;
  if (!lastEventId.startsWith(prefix)) {
    return null;
  }

  const seqStr = lastEventId.slice(prefix.length);
  if (!/^\d+$/.test(seqStr)) {
    return null;
  }

  const lastSeq = parseInt(seqStr, 10);
  if (!Number.isSafeInteger(lastSeq) || lastSeq < 0) {
    return null;
  }

  const state = projectBuffers.get(pid);
  if (!state || state.buffer.length === 0) {
    return null;
  }

  const oldestSeq = state.buffer[0].seq;
  const newestSeq = state.buffer[state.buffer.length - 1].seq;

  // Invalid / future sequence number check
  if (lastSeq > newestSeq) {
    return null;
  }

  // Evicted check: if lastSeq is older than the oldest buffered event minus 1
  if (lastSeq < oldestSeq - 1) {
    return null;
  }

  // Return all events strictly after lastSeq in chronological order
  return state.buffer.filter((e) => e.seq > lastSeq);
}

/**
 * Returns a copy of the replay buffer for a project (useful for testing/diagnostics).
 */
export function getProjectReplayBuffer(projectId) {
  if (!projectId) return [];
  const pid = projectId.toString();
  const state = projectBuffers.get(pid);
  return state ? [...state.buffer] : [];
}

/**
 * Clears replay buffer and cancels cleanup timer for a project, or all projects if omitted.
 */
export function clearProjectReplayBuffer(projectId = null) {
  if (!projectId) {
    for (const [pid, state] of projectBuffers.entries()) {
      if (state.timer) clearTimeout(state.timer);
    }
    projectBuffers.clear();
    return;
  }
  const pid = projectId.toString();
  const state = projectBuffers.get(pid);
  if (state) {
    if (state.timer) clearTimeout(state.timer);
    projectBuffers.delete(pid);
  }
}

/**
 * Subscribes a listener to events for a specific project.
 * Returns an unsubscribe function for convenient cleanup.
 */
export function subscribeProjectEvents(projectId, listener) {
  if (!projectId || typeof listener !== 'function') return () => {};
  const channel = `project:${projectId.toString()}`;
  projectEventBus.on(channel, listener);

  return () => {
    projectEventBus.off(channel, listener);
  };
}

/**
 * Returns the current active subscriber count for a project channel.
 */
export function getProjectSubscriberCount(projectId) {
  if (!projectId) return 0;
  const channel = `project:${projectId.toString()}`;
  return projectEventBus.listenerCount(channel);
}
