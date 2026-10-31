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
 */
export function emitProjectEvent(projectId, event, data) {
  if (!projectId) return;
  const channel = `project:${projectId.toString()}`;
  projectEventBus.emit(channel, { event, data, timestamp: new Date().toISOString() });
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

