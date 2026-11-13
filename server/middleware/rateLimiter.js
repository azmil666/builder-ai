import crypto from "crypto";
import { isRedisEnabled, getRedisClient } from "../config/redis.js";

/**
 * Sliding-window rate limiter middleware with optional distributed Redis adapter.
 * Uses atomic Redis sorted-sets (ZREMRANGEBYSCORE + ZADD + ZCARD + PEXPIRE) when Redis is enabled,
 * falling back seamlessly to an in-memory sliding-window when Redis is unset or disabled.
 */
export function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 100,
  message = "Too many requests. Please try again later.",
  keyGenerator = (req) => req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "global",
}) {
  const hits = new Map();

  // Periodic in-memory garbage collection every 60 seconds
  const sweepInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (now > record.resetTime) {
        hits.delete(key);
      }
    }
  }, 60 * 1000);

  // Do not hold process open in tests
  if (sweepInterval.unref) {
    sweepInterval.unref();
  }

  return async function rateLimiter(req, res, next) {
    // In test environment, allow bypassing unless explicitly testing rate limits
    if (process.env.NODE_ENV === "test" && !req.headers["x-test-rate-limit"]) {
      return next();
    }

    const key = keyGenerator(req);
    const now = Date.now();

    // 1. Distributed Redis sliding-window mode
    if (isRedisEnabled()) {
      const redis = getRedisClient();
      if (redis) {
        try {
          const redisKey = `builder:ratelimit:${key}`;
          const windowStart = now - windowMs;
          const member = `${now}:${crypto.randomUUID()}`;

          const pipeline =
            typeof redis.pipeline === "function"
              ? redis.pipeline()
              : typeof redis.multi === "function"
                ? redis.multi()
                : null;

          let results;
          if (pipeline) {
            pipeline.zremrangebyscore(redisKey, 0, windowStart);
            pipeline.zadd(redisKey, now, member);
            pipeline.zcard(redisKey);
            pipeline.pexpire(redisKey, windowMs);
            results = await pipeline.exec();
          } else {
            if (typeof redis.zremrangebyscore === "function") {
              await redis.zremrangebyscore(redisKey, 0, windowStart);
            }
            if (typeof redis.zadd === "function") {
              await redis.zadd(redisKey, now, member);
            }
            const zcardResult =
              typeof redis.zcard === "function" ? await redis.zcard(redisKey) : 1;
            if (typeof redis.pexpire === "function") {
              await redis.pexpire(redisKey, windowMs);
            }
            results = [[null, null], [null, null], [null, zcardResult], [null, null]];
          }

          let currentCount = 1;
          if (Array.isArray(results) && results[2] !== undefined) {
            const zcardEntry = results[2];
            currentCount = Array.isArray(zcardEntry) ? zcardEntry[1] : zcardEntry;
          }

          const remaining = Math.max(0, max - currentCount);
          const resetSeconds = Math.ceil(windowMs / 1000);

          res.setHeader("RateLimit-Limit", max);
          res.setHeader("RateLimit-Remaining", remaining);
          res.setHeader("RateLimit-Reset", resetSeconds);

          if (currentCount > max) {
            res.setHeader("Retry-After", resetSeconds);
            return res.status(429).json({
              error: message,
              retryAfter: resetSeconds,
            });
          }

          return next();
        } catch (redisErr) {
          // Fail open on Redis errors so transient network drops never block traffic
          console.warn(`[RateLimiter] Redis error, failing open: ${redisErr.message}`);
          return next();
        }
      }
    }

    // 2. In-memory sliding-window fallback
    let record = hits.get(key);
    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      hits.set(key, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, max - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader("RateLimit-Limit", max);
    res.setHeader("RateLimit-Remaining", remaining);
    res.setHeader("RateLimit-Reset", resetSeconds);

    if (record.count > max) {
      res.setHeader("Retry-After", resetSeconds);
      return res.status(429).json({
        error: message,
        retryAfter: resetSeconds,
      });
    }

    next();
  };
}

// 1. Auth limiter: protects login & register endpoints against brute-force attacks (10 attempts per 15 min per IP)
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many authentication attempts. Please try again in 15 minutes.",
  keyGenerator: (req) => `auth:${req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "ip"}`,
});
export const authLimiter = authRateLimiter;

// 2. Project generation limiter: protects expensive multi-file LLM generation (10 creations per 10 min per user)
export const aiGenerationRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: "Project creation limit reached. Please wait before generating another project.",
  keyGenerator: (req) => `gen:${req.user?.userID || req.user?.userId || req.ip}`,
});
export const generationLimiter = aiGenerationRateLimiter;

// 3. Conversational revision limiter: protects diff generation LLM endpoint (25 revisions per 10 min per user)
export const aiRevisionRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 25,
  message: "Revision rate limit exceeded. Please wait a few minutes before submitting more edits.",
  keyGenerator: (req) => `rev:${req.user?.userID || req.user?.userId || req.ip}`,
});
export const revisionLimiter = aiRevisionRateLimiter;
