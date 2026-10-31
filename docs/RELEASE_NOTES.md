# Builder AI — Release Notes

**Version:** `v1.0.0-rc1` (Production Release Candidate 1)  
**Date:** October 31, 2026  
**Status:** Approved for Production Deployment  
**Test Suite:** 148 / 148 Tests Passing Across 12 Suites  

---

## 1. Overview & Highlights

Builder AI `v1.0.0-rc1` represents the culmination of a full-stack stabilization, generative design transformation, and production hardening initiative. The platform transitions from an unstable prototype into a resilient, production-ready AI website generation and editing suite.

### Core Highlights:
- **Design Intelligence Architecture:** Websites are no longer generated from generic, monolithic SaaS templates. Every site receives a structured `DesignSpec` establishing archetype identity, color harmony, typography hierarchies, and layout rules before a single file is written.
- **Real-Time SSE Streaming:** Eliminated repeated client-side project polling in favor of authenticated Server-Sent Events (SSE) with resilient, automated polling fallback.
- **Automated Visual Quality Assurance:** An in-workspace layout diagnostic engine detects horizontal overflow (<768px), cramped grid structures, dead image URLs, and accessibility omissions with 1-click targeted AI corrections.
- **Professional Website Builder Workspace:** Replaced the basic view with a multi-file tab bar, quick open fuzzy search (`Cmd/Ctrl+P`), responsive viewport emulation (Desktop, Tablet, Mobile), Sandpack runtime error telemetry, and full file system operations.
- **Security & Data Isolation:** Eradicated fallback JWT secrets, implemented IP rate limiting on authentication and AI endpoints, enforced owner-scoped multitenancy, and redacted credentials from error logs.

---

## 2. Implemented Capabilities by Milestone

### Phase 1: Security Hardening & Stabilization
- **Session Persistence:** Configured strict `httpOnly`, `sameSite: lax` 30-day JWT cookies. Enabled both `GET` and `POST` handlers on `/api/auth/me`.
- **Secret Enforcement:** Server verifies `JWT_SECRET` presence on startup and exits immediately if missing; fallback strings removed.
- **Rate Limiting:** Added memory-efficient token bucket rate limiting on `/api/auth/login`, `/api/auth/register`, `/api/projects`, and `/api/projects/:id/chat`.
- **Schema Synchronization:** Added Mongoose hooks synchronizing legacy `CurrentFile` and modern `currentFile` fields across legacy documents.
- **Sensitive Data Redaction:** Centralized error sanitizer strips OpenRouter API keys (`sk-...`), HTTP Bearer tokens, and MongoDB credentials.

### Phase 2: Design Intelligence & Code Quality
- **Structured DesignSpec (Zod):** Implemented `DesignSpecSchema` capturing website purpose, target audience, brand personality, and visual archetype.
- **Design Archetypes:** Supported distinct visual identities: Minimal SaaS, Editorial Luxury, Neo-Brutalist, Retro Terminal, and Developer Dark.
- **Parallel Generation (`pMap`):** Concurrently generates planned components (`MAX_CONCURRENCY=6`) with automated retry rounds for transient failures.
- **AST & Code Validation:** Strips rogue markdown code fences, auto-repairs unclosed void JSX tags (`<br />`, `<img />`), enforces default export contracts, and blocks server-only modules (`fs`, `child_process`).

### Phase 3: Dashboard & Workspace Redesign
- **Dashboard Transformation:** Built project search, category filtering (All, Live, Drafts), and responsive preview placeholders displaying visual archetype cards.
- **Multi-File Tab Bar:** Fast tab switching, active tab highlights, and unsaved changes tracking (`●`).
- **Quick Open Modal:** Fast fuzzy file lookup with keyboard arrow navigation (`Cmd/Ctrl+P`).
- **File Management:** Live modal workflows for creating new components from templates, renaming files, and deleting components with safety locks on `/App.js` and `/styles.css`.
- **Responsive Viewports:** Instant switcher between Desktop (100%), Tablet (768px), and Mobile (375px with device frame).

### Phase 4: Real-Time SSE & Visual QA
- **Real-Time Progress Streaming:** Implemented `GET /api/projects/:id/stream` delivering `initial_state`, `design_spec`, `plan`, `file_start`, `file_complete`, `completed`, and `failed` SSE events.
- **Automated Visual QA Engine:** Evaluates generated React codebases against layout constraints, detecting mobile clipping, multi-column grid failures, broken image URLs, and missing accessibility metadata.
- **1-Click AI Fix Workflow:** Translates detected visual defects into surgical revision prompts, directing the LLM to patch layout bugs without altering unrelated components or violating the DesignSpec.

### Phase 5: Production Readiness & Release Engineering
- **End-to-End User Journey Audit:** Verified registration, login, project creation, generation, file editing, revision diffing, publishing, and standalone ZIP export.
- **CORS & Startup Resilience:** Configured defensive origin splitting supporting custom origin lists and local fallback.
- **Production Error Masking:** Configured centralized Express error handling to prevent stack trace leakage when `NODE_ENV === "production"`.

---

## 3. Transformation Git Commit History

The following 13 commits comprise this transformation:

| Commit Hash | Commit Subject |
| :--- | :--- |
| `d8553a1` | `docs: add Builder AI architecture audit` |
| `2d80c36` | `fix: stabilize authentication and project workflows` |
| `213ddb1` | `fix: stabilize authentication and project workflows#2` |
| `d1256ef` | `security: harden backend and add regression tests` |
| `f17b1ba` | `feat: introduce structured AI design specifications` |
| `1f63f68` | `feat: improve AI website design generation` |
| `8639d07` | `feat: validate and repair generated React projects` |
| `922e91d` | `feat: redesign Builder AI dashboard` |
| `3b0ce26` | `feat: build professional website editor workspace` |
| `2af181d` | `feat: improve editor and project file management` |
| `b171444` | `feat: stream generation progress with SSE` |
| `f1c5c00` | `feat: add generated website visual quality checks` |
| `395881d` | `test: verify production readiness and core workflows` |

---

## 4. Verification & Test Metrics

- **Unit & Integration Suite:** 148 / 148 tests passing across 12 test files (`node --test`).
- **Client Static Analysis:** 0 errors reported by Oxlint across 36 frontend modules.
- **Production Build:** Vite bundle compiled in 364ms with zero compilation errors.
- **Git Hygiene:** 0 whitespace or formatting errors reported by `git diff --check`.

---

## 5. Known Limitations & Operational Considerations

1. **In-Memory Rate Limiting:** The built-in rate limiter stores IP counters in Node.js process memory. In a horizontally scaled cluster with multiple instances behind a load balancer, rate limits operate per-instance. For clustered production environments, backing with Redis is recommended.
2. **Third-Party CDN Dependencies:** Sandpack preview requires internet access to fetch Tailwind CSS (`cdn.tailwindcss.com`) and font definitions. Air-gapped intranet deployments will require local font bundling.
3. **OpenRouter Upstream Limits:** Generation throughput is subject to the configured OpenRouter account tier and rate limits. The platform defaults to `AI_MAX_CONCURRENCY=6` to maintain balance between speed and upstream rate thresholds.

