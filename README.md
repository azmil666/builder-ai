# Builder AI

Builder AI is a web application for creating and editing React websites from text prompts. It plans a project's files, generates their contents through OpenRouter, and provides a browser-based editor and preview. Users can revise projects with follow-up prompts, edit files directly, and publish a read-only project link.

## Features

- Account registration and login with an HTTP-only session cookie.
- Create and manage projects associated with the signed-in account.
- Generate a React project from a prompt, with file generation progress shown in the builder.
- Edit generated files and preview the application in the browser.
- Request changes to an existing project through a conversation.
- Publish a project and view it without signing in.
- Export project files from the client.

## Technology

- **Client:** React 19, Vite, Tailwind CSS, React Router, Sandpack
- **Server:** Node.js, Express 5
- **Database:** MongoDB with Mongoose
- **AI:** OpenRouter through the AI SDK

## Project structure

```text
client/   React application
server/   Express API, database models, and AI generation services
```

## Requirements

- Node.js and npm
- A MongoDB database
- An OpenRouter API key

## Setup

Install dependencies in each application directory:

```bash
cd server
npm install

cd ../client
npm install
```

Create `server/.env` with the server configuration:

```dotenv
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/builder-ai
ORIGINS=http://localhost:5173
JWT_SECRET=replace-with-a-long-random-secret
OPENROUTER_API_KEY=your-openrouter-api-key
# Optional; defaults to openrouter/free
OPENROUTER_MODEL=openrouter/free
# Optional; defaults to 6
AI_MAX_CONCURRENCY=6
```

`ORIGINS` is a comma-separated list of client origins permitted to make credentialed API requests. Set `JWT_SECRET` to a private random value, especially in production.

Create `client/.env` if the API is not available at the same origin as the client:

```dotenv
VITE_BASE_URL=http://localhost:3000
```

When `VITE_BASE_URL` is omitted, the client sends API requests to its own origin. The client and server must be configured so cookies and CORS work for the origins being used.

## Run locally

Start the API in one terminal:

```bash
cd server
npm run dev
```

Start the client in another terminal:

```bash
cd client
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`. The API defaults to `http://localhost:3000`; its root route returns a simple liveness message.

For a production client build:

```bash
cd client
npm run build
```

The generated static files are placed in `client/dist`. The server does not serve this directory; deploy the client and API separately or configure a web server to serve the client and proxy API requests.

## How project generation works

1. A signed-in user submits a prompt. The API creates a project record and starts generation in the background.
2. The AI service creates a file plan, then generates the planned files. It ensures the plan includes `/App.js` and `/styles.css`.
3. The server saves files as they are completed. The client polls the project while generation is in progress.
4. The builder displays the files and a live preview. Direct edits are saved to the API.
5. Follow-up prompts request changes to the existing project. Publishing makes the project available through its public URL.

## API overview

All routes are served under `/api`. Project and account routes require the session cookie unless noted.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | Public | Create an account |
| `POST` | `/api/auth/login` | Public | Sign in |
| `POST` | `/api/auth/logout` | Authenticated | Clear the session cookie |
| `GET` | `/api/auth/me` | Authenticated | Get the current user |
| `POST` | `/api/projects` | Authenticated | Start a project from a prompt |
| `GET` | `/api/projects` | Authenticated | List the user's projects |
| `GET` | `/api/projects/:id` | Authenticated | Get project details and files |
| `DELETE` | `/api/projects/:id` | Authenticated | Delete a project |
| `PUT` | `/api/projects/:id/files` | Authenticated | Save project files |
| `POST` | `/api/projects/:id/chat` | Authenticated | Request a project revision |
| `POST` | `/api/projects/:id/publish` | Authenticated | Publish a project |
| `GET` | `/api/projects/public/:id` | Public | Get a published project |

## Available scripts

### Client (`client/`)

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Build the client for deployment |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run Oxlint |

### Server (`server/`)

| Command | Description |
| --- | --- |
| `npm start` | Start the API with Node.js |
| `npm run dev` | Start the API with Nodemon |

