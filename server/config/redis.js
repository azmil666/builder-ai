import Redis from "ioredis";

let primaryClient = null;
let subscriberClient = null;
let redisOverride = null;

/**
 * Returns true if Redis multi-instance mode is enabled.
 */
export function isRedisEnabled() {
  if (redisOverride !== null) {
    return Boolean(redisOverride.enabled);
  }
  return Boolean(process.env.REDIS_URL && process.env.REDIS_URL.trim().length > 0);
}

/**
 * Returns the primary command Redis client, or null if Redis is not enabled.
 */
export function getRedisClient() {
  if (!isRedisEnabled()) return null;
  if (redisOverride?.client) return redisOverride.client;

  if (!primaryClient) {
    try {
      primaryClient = new Redis(process.env.REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        retryStrategy(times) {
          return Math.min(times * 100, 3000);
        },
      });

      primaryClient.on("error", (err) => {
        console.warn("[Redis] Primary client error:", err.message);
      });
    } catch (err) {
      console.warn("[Redis] Initialization error:", err.message);
      return null;
    }
  }

  return primaryClient;
}

/**
 * Creates or retrieves the dedicated subscriber Redis client for Pub/Sub.
 */
export function createRedisSubscriber() {
  if (!isRedisEnabled()) return null;
  if (redisOverride?.subscriber) return redisOverride.subscriber;

  if (!subscriberClient) {
    try {
      subscriberClient = new Redis(process.env.REDIS_URL, {
        lazyConnect: true,
        retryStrategy(times) {
          return Math.min(times * 100, 3000);
        },
      });

      subscriberClient.on("error", (err) => {
        console.warn("[Redis] Subscriber client error:", err.message);
      });
    } catch (err) {
      console.warn("[Redis] Subscriber initialization error:", err.message);
      return null;
    }
  }

  return subscriberClient;
}

/**
 * Gracefully closes all active Redis client connections.
 */
export async function closeRedisClients() {
  const promises = [];

  const clientToClose = primaryClient || redisOverride?.client;
  const subscriberToClose = subscriberClient || redisOverride?.subscriber;

  if (clientToClose && typeof clientToClose.quit === "function") {
    try {
      promises.push(
        clientToClose.quit().catch(() => clientToClose.disconnect?.())
      );
    } catch {
      clientToClose.disconnect?.();
    }
  }
  primaryClient = null;

  if (subscriberToClose && typeof subscriberToClose.quit === "function") {
    try {
      promises.push(
        subscriberToClose.quit().catch(() => subscriberToClose.disconnect?.())
      );
    } catch {
      subscriberToClose.disconnect?.();
    }
  }
  subscriberClient = null;

  await Promise.all(promises);
}

/**
 * Test helper: inject mock Redis client(s) for unit and integration testing.
 */
export function setRedisClientOverride({ client = null, subscriber = null, enabled = true } = {}) {
  redisOverride = { client, subscriber, enabled };
}

/**
 * Test helper: resets any active Redis client overrides.
 */
export function resetRedisClientOverride() {
  redisOverride = null;
}
