# Builder AI — Phase 1 Stabilization & Security Hardening Report

**Project:** Builder AI  
**Milestone:** Phase 1 (Phase 1A: Core Functionality Stabilization & Phase 1B: Security Hardening)  
**Date:** October 31, 2026  
**Status:** Completed & Formally Verified  

---

## 1. Executive Summary

Phase 1 established the baseline operational stability and security hardening of the Builder AI full-stack application. Prior to this milestone, critical runtime defects prevented session persistence on browser refresh, broke follow-up conversational revisions, threw unhandled exceptions during AI generation failures, caused infinite render loops on the client, and left authentication and generation endpoints vulnerable to brute-force and credential spoofing.

Every reported defect was verified against the codebase, repaired using focused modifications without altering the core architecture, and covered with automated regression tests using Node.js native test runner (`node --test`).

---

## 2. Phase 1A: Core Functionality Stabilization

### 2.1 Authentication Session Persistence (Task 1)
- **Problem Verified:** `server/routes/authRoutes.js` registered `/me` as a `POST` route (`authRouter.post('/me', ...)`), whereas `client/src/context/AppContext.jsx` invoked `api.get('/api/auth/me')`. Express returned HTTP 404 on page refresh, clearing user state to `null` and kicking authenticated users to `/login`. Furthermore, catch blocks in `login` and `register` referenced `err` instead of `error`, throwing `ReferenceError: err is not defined`.
- **Solution Applied:**
  - Added `authRouter.get('/me', authMiddleware, me)` to `server/routes/authRoutes.js` (retaining `POST` for backward compatibility).
  - Fixed catch parameters in `client/src/context/AppContext.jsx` from `err` to `error`.
  - Verified cookie security attributes (`httpOnly: true`, `sameSite: "lax"`, `secure: production`, `maxAge: 30 days`, `path: "/"`).
  - Users now remain authenticated across browser refreshes.

### 2.2 Conversational Revision Authorization (Task 2)
- **Problem Verified:** In `server/controllers/chatController.js`, line 30 queried `owner: req.user.userId`. However, `authMiddleware.js` unpacked JWT tokens containing `req.user.userID` (capital `ID`). Consequently, `req.user.userId` was `undefined`, and every revision request failed with HTTP 404 (`Project not found`).
- **Solution Applied:**
  - Standardized user ID resolution to `const userId = req.user.userID || req.user.userId;` in `chatController.js`.
  - Added project ownership checks ensuring callers can only revise their own projects.
  - Wrapped `project.status = "completed"` recovery in a secondary `try/catch` to ensure errors during AI revision fail cleanly without unhandled rejections.

### 2.3 AI Generation Fallback & Sensitive Error Redaction (Task 3)
- **Problem Verified:** In `server/services/ai.js`, the fallback placeholder logic for `/App.js` referenced `file.path.split(...)`. Because `file` was scoped only inside a preceding `pMap` closure, this threw `ReferenceError: file is not defined`, crashing the background worker and obscuring the root cause of generation failures.
- **Solution Applied:**
  - Replaced the faulty reference with an explicit loop over `pendingFiles`. For auxiliary files (e.g., CSS or secondary components), placeholder components are generated so the React application can still compile.
  - For entry point `/App.js`, code explicitly skips generating a fake placeholder. When `/App.js` fails, `!files["/App.js"]` triggers `throw new Error("AI did not generate /App.js entry point")`, allowing `projectController.js` to transition the project to `status: "failed"` honestly.
  - Added and exported `sanitizeError` in `server/controllers/projectController.js` to redact OpenRouter API keys (`sk-...`), Bearer tokens, and MongoDB connection strings from console output and database records.
  - Cleaned up unused import `el` from `zod/v4/locales`.

### 2.4 Database Schema Consistency (Task 4)
- **Problem Verified:** `server/models/Project.js` defined `CurrentFile` (PascalCase), while `server/controllers/projectController.js` and `client/src/components/AgentProgressDashboard.jsx` read and wrote `currentFile` (camelCase). In Mongoose strict mode, updates to `currentFile` were stripped.
- **Solution Applied:**
  - Defined both `currentFile: { type: String, default: null }` and `CurrentFile: { type: String, default: null }` in `ProjectSchema`.
  - Added Mongoose `post('init')` and `pre('save')` hooks to synchronize `CurrentFile` with `currentFile` automatically for legacy documents.
  - Updated `findByIdAndUpdate` calls in `projectController.js` to write both fields and updated controllers to fall back cleanly: `project.currentFile ?? project.CurrentFile ?? null`.

### 2.5 React Context and Polling Stability (Task 5)
- **Problem Verified:** `loadProject` and `loadProjects` in `client/src/context/AppContext.jsx` were unmemoized. In `HomePage.jsx`, `useEffect(..., [loadProjects])` re-triggered on every state update, causing an infinite render cascade. In `AppContext.jsx`, polling thrashed interval creation on every tick.
- **Solution Applied:**
  - Wrapped `checkSession`, `login`, `register`, `logout`, `loadProjects`, and `loadProject` in `useCallback`.
  - Polling interval (2000ms) now starts only when `activeProject.status` is `"generating"`, `"pending"`, or `"revising"`.
  - Polling stops immediately upon transitioning to `"completed"` or `"failed"`, resetting `chatLoading` to `false`.
  - Switching projects or unmounting cleans up the active timer via `clearInterval`.

---

## 3. Phase 1B: Security Hardening

### 3.1 JWT Secret Handling & Startup Safety
- **Vulnerability Eliminated:** Both `server/controllers/authController.js` and `server/middleware/authMiddleware.js` previously contained insecure fallback secrets (`process.env.JWT_SECRET || "fallback_secret"`). If `JWT_SECRET` was omitted in deployment, attackers could forge arbitrary tokens.
- **Hardening Implementation:**
  - Added mandatory environment validation at server boot in `server/server.js`:
    ```javascript
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length === 0) {
      console.error("[FATAL] Missing required environment variable: JWT_SECRET");
      process.exit(1);
    }
    ```
  - Added `getJwtSecret()` in `authController.js` which throws if `JWT_SECRET` is unset.
  - Updated `authMiddleware.js` to return HTTP 500 (`Authentication system is not properly configured`) if `JWT_SECRET` is missing at runtime, rejecting all forged fallback signatures.
  - No secret values are ever printed in logs or error messages.

### 3.2 Rate Limiting Strategy
- **Risk Addressed:** Unprotected endpoints allowed automated password brute-forcing on auth routes and resource exhaustion on expensive AI generation and conversational revision endpoints.
- **Hardening Implementation:**
  - Created a memory-safe, zero-dependency sliding window rate limiter in `server/middleware/rateLimiter.js`.
  - Implemented automatic sweep intervals (60s) to prune expired cache records without holding the process open (`unref()`).
  - Added RFC-standard headers: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, and `Retry-After`.
  - Applied targeted limiters:
    1. **`authRateLimiter`:** 10 requests per 15 minutes per IP applied to `/api/auth/register` and `/api/auth/login`.
    2. **`aiGenerationRateLimiter`:** 10 project creations per 10 minutes per user applied to `POST /api/projects`.
    3. **`aiRevisionRateLimiter`:** 25 revisions per 10 minutes per user applied to `POST /api/projects/:id/chat`.
  - Test-bypass enabled during automated test runs (`NODE_ENV === 'test'`) unless explicitly triggered with `x-test-rate-limit`.

### 3.3 Project Access Control & CastError Guarding
- **Audit Findings & Fixes:**
  - Verified multi-tenant data isolation: all authenticated endpoints (`getProject`, `deleteProject`, `updateProjectFiles`, `publishProject`, `chat`) enforce `owner: userId`. Unauthorized tenants receive HTTP 404.
  - Guarded against unhandled Mongoose `CastError` (which previously produced HTTP 500 when non-hex/malformed IDs were submitted). Added `mongoose.isValidObjectId(req.params.id)` validation across all routes, returning HTTP 404 cleanly.
  - Enforced public access rules: `getPublicProject` verifies `project.published === true`. Unpublished projects return HTTP 403 (`Project is not published yet`). Private message logs and internal metadata are excluded from public responses.

---

## 4. Automated Regression Test Suite

A complete, zero-dependency automated test suite was constructed using Node's native test runner (`node --test`). Tests execute in milliseconds without external network or database dependencies.

### 4.1 Test Suites Summary

| Test Suite | File | Tests | Status |
| :--- | :--- | :---: | :---: |
| **Phase 1A: Core Stabilization** | `server/test/phase1a.test.js` | 9 | PASS |
| **Phase 1B: Security & Permissions** | `server/test/phase1b_security.test.js` | 13 | PASS |
| **Total** | | **22** | **PASS (100%)** |

### 4.2 Test Matrix Details

1. `authRoutes registers both GET and POST for /me` (Contract verification)
2. `authMiddleware rejects unauthenticated requests without session token` (HTTP 401)
3. `authMiddleware decodes valid JWT token and populates req.user` (Token payload extraction)
4. `authMiddleware rejects invalid/tampered token` (Signature verification)
5. `resolves authenticated user ID from both userID and userId payload formats` (Defensive lookup)
6. `does not throw ReferenceError when processing failed pending files` (Loop boundary check)
7. `redacts sensitive API keys and authorization headers from error messages` (Regex sanitization)
8. `ProjectSchema includes both currentFile and CurrentFile paths` (Schema registration)
9. `Project document synchronizes currentFile and legacy CurrentFile` (Hook synchronization)
10. `getJwtSecret returns configured JWT_SECRET when present` (Environment retrieval)
11. `getJwtSecret throws when JWT_SECRET is unset or empty` (Fail-safe check)
12. `authMiddleware fails safely with HTTP 500 if JWT_SECRET is missing at runtime` (Runtime safety)
13. `does not accept hardcoded fallback_secret when JWT_SECRET is set` (Anti-forgery check)
14. `rate limiter sets standard headers and blocks requests exceeding threshold` (HTTP 429 & Retry-After)
15. `authRateLimiter, aiGenerationRateLimiter, and aiRevisionRateLimiter are configured` (Middleware integrity)
16. `rejects malformed MongoDB ObjectId with HTTP 404` (CastError prevention on 6 endpoints)
17. `getPublicProject returns 403 when project is not published` (Public access restriction)
18. `getPublicProject returns 200 with public fields when project is published` (Public disclosure safety)
19. `enforces owner verification on private project queries` (Tenant isolation)
20. `applyOperations applies create, update, and delete diff operations correctly` (Diff engine integrity)
21. `applyOperations logs error cleanly when search block cannot be matched` (Non-fatal diff failure)
22. `sanitizeError redacts Bearer tokens, OpenRouter API keys, and MongoDB auth` (Multi-pattern redaction)

---

## 5. Verification Commands and Outputs

### Backend Tests
```bash
cd server && npm test
```
```text
> server@1.0.0 test
> node --test

✔ Phase 1A: Core Functionality Stabilization Tests (7.12ms)
✔ Phase 1B: Security Hardening & Regression Suite (5.35ms)
ℹ tests 22
ℹ suites 11
ℹ pass 22
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 323.26ms
```

### Client Linting (`oxlint`)
```bash
cd client && npm run lint
```
```text
Found 5 warnings and 0 errors.
Finished in 28ms on 25 files with 92 rules using 8 threads.
```

### Client Production Build (`vite build`)
```bash
cd client && npm run build
```
```text
vite v8.2.0 building client environment for production...
✓ 1912 modules transformed.
dist/index.html                   0.46 kB │ gzip:   0.29 kB
dist/assets/index-DdBUVUJE.css   33.22 kB │ gzip:   6.64 kB
dist/assets/index-CP2UDYuP.js  1,009.15 kB │ gzip: 335.96 kB
✓ built in 356ms
```

### Backend Syntax Check
```bash
node -c server/server.js server/routes/authRoutes.js server/routes/projectRoutes.js \
  server/controllers/authController.js server/controllers/chatController.js \
  server/controllers/projectController.js server/middleware/authMiddleware.js \
  server/middleware/rateLimiter.js server/models/Project.js server/services/ai.js
```
```text
Exit code: 0 (No syntax errors detected)
```

### Git Diff Verification
```bash
git diff --check
```
```text
Exit code: 0 (No trailing whitespace or line-ending anomalies)
```

---

## 6. Limitations and Remaining Risks

1. **In-Memory Rate Limiting:** The sliding window rate limiter stores hit counters in Node.js process memory. In a distributed multi-instance deployment behind a load balancer, rate limits will be per-instance rather than global. A shared Redis-backed store should be evaluated when scaling out.
2. **Synchronous Polling vs SSE:** The frontend polls `GET /api/projects/:id` every 2 seconds during active generation. While polling cleanup and stale closures are resolved, this will be replaced with Server-Sent Events (SSE) in Phase 4 for real-time progress streaming.
3. **Regex JSX Code Repair:** Post-generation code repair currently uses regex heuristics. In Phase 2, this will be upgraded to AST-backed validation to eliminate syntax edge cases on deeply nested JSX.

---

## 7. Deliverable Status & Next Milestone

Phase 1 (1A & 1B) is **complete and verified**. The application's core functionality and backend security are stabilized. The repository is ready for Phase 2: Design Intelligence & Prompt Engine Transformation.

