# Builder AI — Production Deployment Checklist

**Target Release:** `v1.0.0-rc1`  
**Applicability:** Cloud Container (Docker / ECS / Kubernetes), VPS (Ubuntu / Debian), PaaS (Render / Railway / Fly.io)

---

## 1. Pre-Deployment Verification Gates

Before initiating production deployment, confirm that all verification gates pass locally or in CI:

- [ ] **Branch Status:** On `feature/builder-ai-transformation` with a clean working tree.
- [ ] **Automated Test Suite:** Run `npm test --prefix server` and verify **148/148 tests pass** (0 failures).
- [ ] **Client Static Analysis:** Run `npm run lint --prefix client` and verify **0 errors**.
- [ ] **Client Production Build:** Run `npm run build --prefix client` and verify build completes with exit code 0.
- [ ] **Git Whitespace & Formatting:** Run `git diff --check` and verify 0 issues.

---

## 2. Production Environment Variables (Names Only)

Verify all required variables are injected via secure secret management (AWS Secrets Manager, Doppler, Vault, or host environment variables). **Never commit raw values to git.**

### Backend (`server/.env`)

| Variable Name | Required | Description | Security Guideline |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | **Yes** | Execution mode (`production`) | Enables error masking & cookie `secure: true` |
| `PORT` | No | Internal port (defaults to `3000`) | Standard internal listener port |
| `MONGODB_URI` | **Yes** | Connection string for MongoDB | Must use TLS/SSL and strong credentials |
| `ORIGINS` | **Yes** | Allowed CORS origins (comma-separated) | Exact production domain(s) e.g. `https://builderai.app` |
| `JWT_SECRET` | **Yes** | Secret used to sign session cookies | Minimum 32 random characters (cryptographically secure) |
| `OPENROUTER_API_KEY` | **Yes** | API key for AI generation services | Dedicated production key with spending limits |
| `OPENROUTER_MODEL` | No | AI model identifier (defaults to `openrouter/free`) | Configure production model e.g. `anthropic/claude-3.5-sonnet` |
| `AI_MAX_CONCURRENCY` | No | Max parallel file generations (defaults to `6`) | Balance between speed and API rate limits |

### Frontend (`client/.env`)

| Variable Name | Required | Description | Security Guideline |
| :--- | :---: | :--- | :--- |
| `VITE_BASE_URL` | No | Backend API origin (defaults to current origin) | Only required if API is hosted on a separate subdomain |

---

## 3. Database & Storage Provisioning

- [ ] **MongoDB Version:** MongoDB 6.0+ with WiredTiger storage engine.
- [ ] **High Availability:** Production replica set with automatic failover (e.g. MongoDB Atlas M10+).
- [ ] **Network Security:** Database restricted to VPC or whitelisted backend server IPs.
- [ ] **Indexes:** Verify unique index on `User.email` and compound index on `Project.owner + updatedAt`.
- [ ] **Backup Schedule:** Automated daily snapshots with 30-day point-in-time recovery (PITR).

---

## 4. Reverse Proxy & Network Configuration (Nginx / Cloudflare / ALB)

Configure your edge reverse proxy with the following critical rules:

### 4.1 Server-Sent Events (SSE) Proxy Directives
The progress stream (`GET /api/projects/:id/stream`) uses persistent HTTP connections. Proxies must disable response buffering:
```nginx
location /api/projects/ {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Critical for SSE streaming:
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}
```

### 4.2 Security Headers
- [ ] Enforce HTTPS termination with TLS 1.3 / 1.2 only.
- [ ] Set `Strict-Transport-Security: max-age=31536000; includeSubDomains`.
- [ ] Set `X-Content-Type-Options: nosniff`.
- [ ] Set `Referrer-Policy: strict-origin-when-cross-origin`.

---

## 5. Deployment Step-by-Step Execution

### Step 1: Build Frontend Assets
```bash
cd client
npm ci --omit=dev=false
npm run build
```
Upload or link `client/dist/` to your static CDN (Cloudflare Pages, S3/CloudFront) or web root directory.

### Step 2: Prepare Backend Runtime
```bash
cd ../server
npm ci --omit=dev
```

### Step 3: Launch Process Manager (PM2 Example)
```bash
pm2 start server.js --name "builder-ai-api" -i max --env production
```
Or start the pre-built Docker container:
```bash
docker run -d --name builder-ai-api \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file /etc/builder-ai/production.env \
  builder-ai:v1.0.0-rc1
```

### Step 4: Verify Health Liveness
```bash
curl -f http://localhost:3000/
# Expected response: "Server is Live!"
```

---

## 6. Post-Deployment Smoke Verification

Execute the following smoke test workflow immediately following deployment:

1. **User Sign Up:** Register a new test account at `/register`. Confirm successful redirection to `/`.
2. **Session Verification:** Inspect cookie storage in browser DevTools. Confirm `token` cookie has `HttpOnly` and `Secure` attributes set.
3. **Project Generation:** Enter prompt: `"Minimalist portfolio for an architect"`.
   - Confirm SSE events update the UI in real time (`initial_state` → `design_spec` → `plan` → `file_start` → `completed`).
4. **Editor Operations:**
   - Open `/App.js`, modify heading text, confirm `●` dirty indicator appears.
   - Wait 1 second and confirm auto-save syncs (`Saved` badge appears).
   - Press `Cmd/Ctrl+P` and verify Quick Open fuzzy search opens files.
5. **Preview Viewports:** Toggle Desktop, Tablet, and Mobile viewport buttons. Confirm preview updates smoothly.
6. **Visual QA Check:** Open the `Visual QA` tab in the left rail, click `Run Audit`, and verify report output.
7. **Publishing:** Click `Publish`, copy URL, open in an incognito window, and verify public read-only rendering at `/publish/:id`.
8. **Export:** Click `Export`, download ZIP, unzip locally, run `npm install && npm run build`, and verify clean standalone build.

---

## 7. Rollback Strategy & Plan

In the event of an unforeseen production incident or critical failure:

### 7.1 Fast Code Rollback
- Revert edge proxy traffic to the previous stable release container or build artifact.
- Both `currentFile` and legacy `CurrentFile` are synchronized by Mongoose schema hooks, ensuring total backward compatibility with older database documents.

### 7.2 Database Rollback Safety
- Phase 1–5 changes introduce purely additive database fields (`designSpec`, `filesPlanned`, `filesGenerated`, `published`).
- No destructive migrations or column drops were executed.
- Previous versions of Builder AI can safely read and write to the same database without schema conflicts or document loss.

### 7.3 Incident Contact & Escalation
- If generation fails due to upstream API outages, verify OpenRouter status at `https://status.openrouter.ai`.
- Verify database connectivity: check MongoDB connection pool metrics and ensure IP whitelist rules are active.

