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
- **Publishing & Standalone Export:** Public read-only site links and standalone downloadable Vite + React project ZIP bundles.

---

## Technology Stack

- **Client:** React 19, Vite, Tailwind CSS 4, React Router 7, Sandpack React, Lucide Icons, JSZip, Oxlint
- **Server:** Node.js, Express 5, Mongoose 9, JWT, Bcrypt, Zod, p-map, AI SDK (@ai-sdk/openai)
- **Database:** MongoDB
- **AI Provider:** OpenRouter

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
