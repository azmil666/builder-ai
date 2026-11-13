import { EventEmitter } from 'events';
import crypto from 'crypto';
import {
  isRedisEnabled,
  getRedisClient,
  createRedisSubscriber,
  closeRedisClients,
} from '../config/redis.js';

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
export const BUFFER_TTL_SECONDS = 900; // 15 minutes in seconds

// Unique instance identifier for multi-instance deduplication
export const CURRENT_WORKER_ID = crypto.randomUUID();

// Map of projectIdString -> { seq: number, buffer: Array<{ id, seq, event, data, timestamp }>, timer: NodeJS.Timeout | null }
const projectBuffers = new Map();

let isRedisSubscribed = false;

/**
 * Initializes Redis Pub/Sub listener on channel 'builder:project-events'.
 * Forwards foreign worker messages to local projectEventBus and ignores self-emissions.
 */
export async function initRedisPubSub() {
  if (!isRedisEnabled()) return;
  const subscriber = createRedisSubscriber();
  if (!subscriber) return;

  if (isRedisSubscribed) return;
  isRedisSubscribed = true;

  try {
    if (typeof subscriber.connect === 'function' && subscriber.status === 'wait') {
      await subscriber.connect().catch(() => {});
    }
  } catch {
    // ioredis handles auto-connect
  }

  try {
    await subscriber.subscribe('builder:project-events');
    subscriber.on('message', (channel, messageStr) => {
      if (channel !== 'builder:project-events') return;
      try {
        const payload = JSON.parse(messageStr);
        // Deduplicate against local worker emissions so originating worker never double-fires
        if (payload._workerId === CURRENT_WORKER_ID) {
          return;
        }
        if (!payload.id || !payload.event) return;

        // Extract projectId from id (${projectId}:${seq})
        const colonIdx = payload.id.lastIndexOf(':');
        const pid = colonIdx !== -1 ? payload.id.slice(0, colonIdx) : null;
        if (!pid) return;

        // Synchronize into local ring buffer
        let state = projectBuffers.get(pid);
        if (!state) {
          state = { seq: payload.seq || 0, buffer: [], timer: null };
          projectBuffers.set(pid, state);
        }
        if (payload.seq && payload.seq > state.seq) {
          state.seq = payload.seq;
        }

        const bufferedItem = {
          id: payload.id,
          seq: payload.seq,
          event: payload.event,
          data: payload.data,
          timestamp: payload.timestamp,
        };

        if (!state.buffer.some((e) => e.id === payload.id)) {
          state.buffer.push(bufferedItem);
          if (state.buffer.length > MAX_BUFFER_SIZE) {
            state.buffer.shift();
          }
        }

        // Forward event to local project channel listeners
        const projectChannel = `project:${pid}`;
        projectEventBus.emit(projectChannel, bufferedItem);
      } catch (err) {
        console.warn('[Redis Subscriber] Failed to process message:', err.message);
      }
    });
  } catch (err) {
    isRedisSubscribed = false;
    console.warn('[Redis Subscriber] Subscription error:', err.message);
  }
}

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
 * Synchronously assigns monotonic sequence ID and stores in local buffer.
 * If Redis is enabled, asynchronously publishes to Redis Pub/Sub & replay list.
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

  // Emit immediately on local in-process event bus
  projectEventBus.emit(channel, eventPayload);

  // If Redis is active, publish to multi-instance Redis cluster (fire-and-forget)
  if (isRedisEnabled()) {
    initRedisPubSub().catch(() => {});
    const redis = getRedisClient();
    if (redis) {
      (async () => {
        try {
          const seqKey = `builder:seq:${pid}`;
          const replayKey = `builder:replay:${pid}`;
          const pubsubChannel = 'builder:project-events';

          if (typeof redis.incr === 'function') {
            await redis.incr(seqKey);
          }

          const redisPayload = {
            ...eventPayload,
            _workerId: CURRENT_WORKER_ID,
          };
          const serialized = JSON.stringify(redisPayload);

          const pipeline =
            typeof redis.pipeline === 'function'
              ? redis.pipeline()
              : typeof redis.multi === 'function'
                ? redis.multi()
                : null;

          if (pipeline) {
            pipeline.rpush(replayKey, serialized);
            pipeline.ltrim(replayKey, -MAX_BUFFER_SIZE, -1);
            pipeline.expire(replayKey, BUFFER_TTL_SECONDS);
            pipeline.publish(pubsubChannel, serialized);
            await pipeline.exec();
          } else {
            if (typeof redis.rpush === 'function') await redis.rpush(replayKey, serialized);
            if (typeof redis.ltrim === 'function') await redis.ltrim(replayKey, -MAX_BUFFER_SIZE, -1);
            if (typeof redis.expire === 'function') await redis.expire(replayKey, BUFFER_TTL_SECONDS);
            if (typeof redis.publish === 'function') await redis.publish(pubsubChannel, serialized);
          }
        } catch (err) {
          console.warn(`[Redis Pub/Sub] Failed to publish event for project ${pid}:`, err.message);
        }
      })();
    }
  }

  return eventPayload;
}

/**
 * Synchronous local retrieval of missed events from memory ring buffer.
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
 * Asynchronous retrieval of missed events for a project after lastEventId.
 * Reads from Redis replay list when Redis is enabled, falling back to local memory buffer.
 */
export async function getMissedProjectEventsAsync(projectId, lastEventId) {
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

  // Check Redis replay list if Redis is enabled
  if (isRedisEnabled()) {
    const redis = getRedisClient();
    if (redis && typeof redis.lrange === 'function') {
      try {
        const replayKey = `builder:replay:${pid}`;
        const rawEvents = await redis.lrange(replayKey, 0, -1);

        if (Array.isArray(rawEvents) && rawEvents.length > 0) {
          const events = rawEvents
            .map((str) => {
              try {
                return typeof str === 'string' ? JSON.parse(str) : str;
              } catch {
                return null;
              }
            })
            .filter(Boolean);

          if (events.length > 0) {
            const oldestSeq = events[0].seq;
            const newestSeq = events[events.length - 1].seq;

            if (lastSeq > newestSeq) {
              return null;
            }
            if (lastSeq < oldestSeq - 1) {
              return null;
            }

            return events.filter((e) => e.seq > lastSeq);
          }
        }
      } catch (err) {
        console.warn(`[Redis Replay] Error reading replay list for ${pid}:`, err.message);
      }
    }
  }

  // Fallback to local memory ring buffer
  return getMissedProjectEvents(projectId, lastEventId);
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
 * Closes all Redis adapter connections and resets subscription state.
 */
export async function closeRedisAdapters() {
  isRedisSubscribed = false;
  await closeRedisClients();
}

/**
 * Subscribes a listener to events for a specific project.
 * Returns an unsubscribe function for convenient cleanup.
 */
export function subscribeProjectEvents(projectId, listener) {
  if (!projectId || typeof listener !== 'function') return () => {};
  const channel = `project:${projectId.toString()}`;
  projectEventBus.on(channel, listener);

  if (isRedisEnabled()) {
    initRedisPubSub().catch(() => {});
  }

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
