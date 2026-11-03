# Builder AI

Builder AI is a professional AI-native website creation platform. It plans a project's architecture, generates its visual design identity through a structured DesignSpec engine, writes React components in parallel, validates AST syntax and component contracts, and provides a multi-viewport browser editing workspace with real-time Server-Sent Events (SSE) progress and automated Visual QA verification.

---

## Features

- **Authentication & Multi-Tenant Security:** Account registration and login secured with bcrypt password hashing and 30-day `httpOnly`, `sameSite: lax` JWT session cookies.
- **Design Intelligence Engine:** Generates structured visual identity (`DesignSpec`) capturing purpose, target audience, color tokens, and design archetypes (Minimal SaaS, Editorial Luxury, Neo-Brutalist, Retro Terminal, Developer Dark).
- **Parallel AI Generation:** Multi-file concurrent generation (`MAX_CONCURRENCY=6`) via OpenRouter with automatic retry passes and safe non-blocking component fallbacks.
- **AST & Code Validation:** AST parsing and regex heuristics that strip markdown fences, enforce single default exports, repair self-closing JSX elements (`<br />`, `<img />`), and prevent forbidden Node.js server module imports.
- **Real-Time Progress Streaming (SSE):** Authenticated Server-Sent Events stream live generation milestones, file completions, and state transitions with resilient polling fallback.
- **Professional Website Builder Workspace:**
  - **Multi-File Tab Bar:** Fast tab switching, active file indicators, and dirty file state tracking (`●`).
  - **Quick Open Modal:** Fuzzy file search with keyboard navigation (`Cmd/Ctrl + P`).
  - **Multi-Device Viewport Preview:** Instant responsive switching between Desktop (100%), Tablet (768px), and Mobile (375px with device frame).
  - **Runtime Error Telemetry:** Live capture of runtime and compilation errors via Sandpack error bridging.
  - **File Operations:** Real-time file creation, renaming, and deletion with entry point protection (`/App.js`, `/styles.css`).
- **Automated Visual QA Engine:** In-workspace layout audit detecting mobile horizontal overflow (<768px), responsive grid collapse, broken URLs, missing alt tags, and accessibility omissions with 1-click targeted AI fixes.
- **Craftwork Design Intelligence Integration:** Runtime integration of Craftwork's design guidance and taste rules across all generation and revision stages, enforcing bespoke typography, single-theme locks, concentric radii, widow prevention, and anti-AI tells.
- **Publishing & Standalone Export:** Public read-only site links and standalone downloadable Vite + React project ZIP bundles.

---

## Technology Stack

- **Client:** React 19, Vite, Tailwind CSS 4, React Router 7, Sandpack React, Lucide Icons, JSZip, Oxlint
- **Server:** Node.js, Express 5, Mongoose 9, JWT, Bcrypt, Zod, p-map, AI SDK (@ai-sdk/openai)
- **Database:** MongoDB
- **AI Provider:** OpenRouter
- **Design Intelligence:** Craftwork Design System (`craftwork-design`)

---

## Craftwork Design Skill Integration

Builder AI integrates Craftwork's design skill directly into its autonomous model generation pipeline. Rather than relying on local agent configuration directories (`.agents`, `.claude`), the server maintains a project-local, versioned copy of the skill and explicitly injects its design rules into system prompts across both Gemini and OpenRouter providers.

### Storage & Files
- **Upstream Skill Source:** [`server/skills/craftwork-design/upstream/SKILL.md`](server/skills/craftwork-design/upstream/SKILL.md) — The exact upstream specification installed via `@craftwork-design/wizard`.
- **Skill Metadata & Audit:** [`server/skills/craftwork-design/metadata.json`](server/skills/craftwork-design/metadata.json) — Tracks upstream package name (`@craftwork-design/wizard@latest`), retrieval date, refresh steps, and excerpt rationale.
- **Runtime Design Guidance:** [`server/skills/craftwork-design/runtime-guidance.md`](server/skills/craftwork-design/runtime-guidance.md) — The faithful runtime design guidance containing taste rules, archetype dials, layout rules, and anti-AI tells without unauthenticated MCP tools.
- **Skill Service Loader:** [`server/services/craftworkSkill.js`](server/services/craftworkSkill.js) — Loads, validates, and serves prompt-specific guidance. Fails fast with descriptive errors if required skill materials are missing.

### Generation Stages Using Craftwork Guidance
1. **DesignSpec Generation (`DESIGN_SPEC_SYSTEM`):** Guides the model's aesthetic choices, archetype selection (12 archetypes), variance/motion/density dials, single theme lock, and palette derivation.
2. **File Planning (`buildFilePlanSystem`):** Guides file and component architecture, enforcing genre-led planning (single-file for utilities/games vs modular components for brand sites) and avoiding generic identical 3-card sections.
3. **Foundation & Component Code Generation (`buildFileCodeSystem`):** Injects Craftwork taste rules into `/styles.css`, `/App.js`, and all components:
   - **Interactive Hover:** Visible animated hover (150-250ms ease-out) on all interactive elements without recoloring borders on hover alone.
   - **Typographic Discipline:** `text-wrap: balance` for headlines, `text-wrap: pretty` for descriptions, tight letter-spacing (-0.02em to -0.03em), line-height 1.1-1.25, and widow prevention.
   - **Anti-AI Tells:** No em dashes (`—`) or en dashes (`–`), no middle-dot (`·`) separators, no filler verbs ("elevate", "seamless", "next-gen"), and realistic copy.
   - **Surfaces & Geometry:** Concentric nested radii (`outer = inner + padding`), `min-height: 100dvh` for heroes, tinted shadows, and restraint (no background glow blobs).
4. **Targeted AI Repair & Self-Repair (`repairProjectFiles` / `generateSingleFile`):** Ensures repaired files fix syntax/contracts while strictly preserving Craftwork design guidance and DesignSpec tokens.
5. **Project Revisions (`REVISE_SYSTEM` / `reviseProject`):** Applies targeted search/replace operations while preserving the project's saved DesignSpec and Craftwork design consistency unless a redesign is explicitly requested.

### Refresh Procedure
To update or refresh the Craftwork skill content in the future:
1. Run the official installer in the project root:
   ```bash
   npx -y @craftwork-design/wizard@latest add --all
   ```
2. Copy the resulting `.agents/skills/craftwork-assets/SKILL.md` into the project repository:
   ```bash
   cp .agents/skills/craftwork-assets/SKILL.md server/skills/craftwork-design/upstream/SKILL.md
   ```
3. Update `server/skills/craftwork-design/metadata.json` with the updated retrieval date and version.
4. Review `server/skills/craftwork-design/runtime-guidance.md` against upstream changes, maintaining design fidelity and Sandpack/React compatibility while excluding unauthenticated MCP tool calls.
5. Run the test suite to verify prompt integration and regressions:
   ```bash
   npm test --prefix server
   ```

### MCP & Asset Limitations
- **Design Guidance Only:** The integration operates strictly as prompt-level design guidance and taste rules for code generation.
- **Unavailable Features Without MCP Bridge:** Live Craftwork MCP server tools (`craftwork_find_*` catalog search, `craftwork_download_*` asset/font downloads, `craftwork_export_icon`, `craftwork_create_3d_embed`, and paid quota spending) require an active, authenticated MCP connection.
- **Native Implementation:** All websites generated by Builder AI use native React, Tailwind CSS, `lucide-react` SVG icons, and Google Fonts imported via `/styles.css` without relying on live paid Craftwork API calls or unauthenticated external tools.

---

---

## Project Structure

```text
client/         React application, Monaco/Sandpack workspace, and dashboard
server/         Express API, database models, AI pipelines, and test suites
docs/           Architecture audits, phase reports, and deployment specifications
```

---

## Requirements

- **Node.js:** v18+ (tested on Node v20 and v25)
- **MongoDB:** v6+ local instance or MongoDB Atlas cluster
- **OpenRouter API Key:** From [OpenRouter](https://openrouter.ai/)

---

## Setup & Configuration

1. **Install Dependencies:**
   ```bash
   cd server
   npm install

   cd ../client
   npm install
   ```

2. **Server Environment Configuration:**
   Copy `server/.env.example` to `server/.env`:
   ```bash
   cp server/.env.example server/.env
   ```
   Configure the required variables:
   ```dotenv
   PORT=3000
   MONGODB_URI=mongodb://127.0.0.1:27017/builder-ai
   ORIGINS=http://localhost:5173
   JWT_SECRET=replace-with-a-secure-random-secret-at-least-32-chars
   OPENROUTER_API_KEY=your-openrouter-api-key
   OPENROUTER_MODEL=openrouter/free
   AI_MAX_CONCURRENCY=6
   NODE_ENV=development
   ```

3. **Client Environment Configuration:**
   Copy `client/.env.example` to `client/.env`:
   ```bash
   cp client/.env.example client/.env
   ```
   ```dotenv
   VITE_BASE_URL=http://localhost:3000
   ```

---

## Running Locally

Start the backend API server:
```bash
cd server
npm run dev
```

Start the frontend Vite application:
```bash
cd client
npm run dev
```

Open `http://localhost:5173` in your browser. The backend API runs at `http://localhost:3000` (`GET /` returns health liveness).

---

## Available Scripts

### Client (`client/`)

| Command | Description |
| :--- | :--- |
| `npm run dev` | Launch Vite development server with HMR |
| `npm run build` | Compile optimized production bundle to `client/dist` |
| `npm run preview` | Locally preview the production build |
| `npm run lint` | Run Oxlint fast static analysis |

### Server (`server/`)

| Command | Description |
| :--- | :--- |
| `npm start` | Run server in production mode |
| `npm run dev` | Launch server with Nodemon auto-reload |
| `npm test` | Run complete Node.js automated test runner suite |

---

## API Reference

All application endpoints are served under `/api`. Protected routes require the `token` HTTP-only cookie.

| Method | Path | Access | Purpose |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public (Rate Limited) | Create new user account |
| `POST` | `/api/auth/login` | Public (Rate Limited) | Authenticate user & set session cookie |
| `POST` | `/api/auth/logout` | Authenticated | Invalidate session cookie |
| `GET` | `/api/auth/me` | Authenticated | Retrieve authenticated user profile |
| `POST` | `/api/projects` | Authenticated (Rate Limited) | Create project and initiate generation |
| `GET` | `/api/projects` | Authenticated | List all projects owned by user |
| `GET` | `/api/projects/:id` | Authenticated (Owner Only) | Retrieve project details & file tree |
| `DELETE` | `/api/projects/:id` | Authenticated (Owner Only) | Delete project permanently |
| `PUT` | `/api/projects/:id/files` | Authenticated (Owner Only) | Save manual file modifications |
| `POST` | `/api/projects/:id/chat` | Authenticated (Rate Limited) | Request targeted AI project revision |
| `GET` | `/api/projects/:id/stream` | Authenticated (Owner Only) | Stream real-time SSE generation progress |
| `GET` | `/api/projects/:id/qa` | Authenticated (Owner Only) | Run automated Visual QA layout audit |
| `POST` | `/api/projects/:id/publish` | Authenticated (Owner Only) | Publish project to live public URL |
| `GET` | `/api/projects/public/:id` | Public | Access published website read-only |

---

## 🛡️ Resilience & Generation Error Recovery

1. **Rate Limit & High Demand Handling (429 / 503)**:
   - `gemini.js` detects HTTP 429, 503, `RESOURCE_EXHAUSTED`, and high demand messages.
   - Retries with jittered exponential backoff and respects header retry recommendations.
   - Falls back seamlessly to secondary models (`gemini-3.5-flash-lite`) if primary model is exhausted.
   - Exhausted retries bubble formatted, user-friendly error messages into the database and UI.
2. **Nodemon Watch Narrowing**:
   - `server/nodemon.json` configures nodemon to only watch application code directories (`controllers`, `middleware`, `models`, `routes`, `services`, `config`, `server.js`).
   - Ignores `test/**`, `skills/**`, `*.log`, and temporary files to prevent server restarts from terminating active generation processes.
3. **UI Failure State & Recovery**:
   - When a project build fails, `BuilderPage` stops showing the progress/loading view and renders `GenerationFailureView`.
   - Displays clear error causes, rate-limit advice, "Try Again", "Back to Projects", and (if files were generated) "Inspect Partial Files".
4. **Startup Orphan Cleanup**:
   - Interrupted in-flight projects from server crashes or reboots are safely marked as failed with a clean message upon server startup.

