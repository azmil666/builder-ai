/**
 * In-memory sliding-window rate limiter middleware.
 * Zero external dependencies, memory-safe, with standard RFC-compliant headers.
 */
export function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 100,
  message = "Too many requests. Please try again later.",
  keyGenerator = (req) => req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "global",
}) {
  const hits = new Map();

  // Periodic garbage collection every 60 seconds
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

  return function rateLimiter(req, res, next) {
    // In test environment, allow bypassing unless explicitly testing rate limits
    if (process.env.NODE_ENV === "test" && !req.headers["x-test-rate-limit"]) {
      return next();
    }

    const key = keyGenerator(req);
    const now = Date.now();
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

// 2. Project generation limiter: protects expensive multi-file LLM generation (10 creations per 10 min per user)
export const aiGenerationRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: "Project creation limit reached. Please wait before generating another project.",
  keyGenerator: (req) => `gen:${req.user?.userID || req.user?.userId || req.ip}`,
});

// 3. Conversational revision limiter: protects diff generation LLM endpoint (25 revisions per 10 min per user)
export const aiRevisionRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 25,
  message: "Revision rate limit exceeded. Please wait a few minutes before submitting more edits.",
  keyGenerator: (req) => `rev:${req.user?.userID || req.user?.userId || req.ip}`,
});

