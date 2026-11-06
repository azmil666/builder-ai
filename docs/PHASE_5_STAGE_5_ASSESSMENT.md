# BUILDER AI — PHASE 5 STAGE 5 ASSESSMENT
## Server-Sent Events (SSE), Persistence & Recovery Architecture

**Date:** November 6, 2026  
**Role:** Senior Backend Architect, Distributed Systems Engineer & Test Engineer  
**Scope:** Phase 5 Stage 5 — Read-Only Architectural Assessment  
**Mode:** READ-ONLY (No code, test, or dependency modifications)

---

## 1. Executive Summary

This document presents a comprehensive, evidence-based architectural assessment of Builder AI's real-time communication (Server-Sent Events), database persistence lifecycle (MongoDB via Mongoose), and server startup recovery mechanisms.

The system features an in-process event streaming pipeline powered by Node.js `EventEmitter` and HTTP Server-Sent Events, supported by progressive MongoDB updates across the generation lifecycle. However, critical gaps exist around server restart recovery boundaries, client-side SSE connection re-trigger loops, un-emitted revision lifecycle events, and unbounded fallback polling.

### Key Assessment Findings Overview

| Capability | Current Status | Key Location | Critical Risk / Finding |
| :--- | :--- | :--- | :--- |
| **Initial Generation Lifecycle** | **CONFIRMED** | `server/controllers/projectController.js:33` | Progressive saving of files and contract milestones; background promise detached from HTTP request. |
| **Real-time SSE Protocol** | **CONFIRMED** | `server/services/projectEvents.js:17` | Compliant W3C wire formatting, channel-isolated event emitter, per-connection keep-alive heartbeats. |
| **Event Sequence & IDs** | **NOT IMPLEMENTED** | `server/services/projectEvents.js:33` | Events lack monotonic IDs; `Last-Event-ID` header is ignored; no server-side replay buffer. |
| **Startup Recovery** | **PARTIALLY IMPLEMENTED** | `server/server.js:22` | Marks orphaned projects as failed, but **omits** `"visual_verifying"` and `"revising"` statuses, leaving them stuck permanently. |
| **Revision Event Streaming** | **NOT IMPLEMENTED** | `server/controllers/chatController.js:20` | Revision endpoint executes synchronously and **never emits** SSE progress events on `projectEventBus`. |
| **Client SSE Lifecycle** | **PARTIALLY IMPLEMENTED** | `client/src/context/AppContext.jsx:128` | `useEffect` depends on `activeProject?.status`, causing **connection teardown and reconnection on every status transition**. |
| **Polling Fallback** | **PARTIALLY IMPLEMENTED** | `client/src/context/AppContext.jsx:151` | Falls back to 3-second polling on error, but lacks a maximum retry bound, causing **indefinite polling** on stuck projects. |
| **MongoDB Test Isolation** | **CONFIRMED** | `server/test/` | Tests utilize deterministic in-memory Mongoose stubs. No local daemon or disposable test DB is active; tests run offline. |

---

## 2. Actual Generation & Revision Lifecycle

### 2.1 Initial Generation Lifecycle (Code Trace)

```
[Client] AppContext.jsx:handleGenerate(prompt)
   │ HTTP POST /api/projects { prompt }
   ▼
[Server] projectController.js:createProject(req, res)
   ├─ Authenticates user (`req.user.userID`)
   ├─ Project.create({ status: "pending", version: 0, files: {}, ... }) [MongoDB]
   ├─ Returns HTTP 201 with project metadata immediately
   └─ Invokes `runBackgroundGeneration(projectId, prompt)` (unawaited background task)
         │
         ▼
[Server] projectController.js:runBackgroundGeneration(projectId, prompt)
   ├─ Calls `generateProject(prompt, callbacks)` in `server/services/ai.js`
   │    │
   │    ├─ onRequirementContract(contract)
   │    │    ├─ Project.findByIdAndUpdate (persists `requirementContract`, pushes message) [MongoDB]
   │    │    └─ emitProjectEvent(projectId, "requirement_contract", { requirementContract }) [SSE]
   │    │
   │    ├─ onDesignSpec(spec)
   │    │    ├─ Project.findByIdAndUpdate (persists `designSpec`, pushes message) [MongoDB]
   │    │    └─ emitProjectEvent(projectId, "design_spec", { designSpec }) [SSE]
   │    │
   │    ├─ onPlan(plan)
   │    │    ├─ Project.findByIdAndUpdate (`status: "generating"`, `filesPlanned`) [MongoDB]
   │    │    └─ emitProjectEvent(projectId, "plan", { status: "generating", filesPlanned }) [SSE]
   │    │
   │    ├─ onFileStart(path)
   │    │    ├─ Project.findByIdAndUpdate (`currentFile: path`) [MongoDB]
   │    │    └─ emitProjectEvent(projectId, "file_start", { currentFile: path }) [SSE]
   │    │
   │    ├─ onFileComplete(path, code)
   │    │    ├─ Project.save (`files[path] = { content, hash }`, `filesGenerated.push(path)`) [MongoDB]
   │    │    └─ emitProjectEvent(projectId, "file_complete", { path, file: { content } }) [SSE]
   │    │
   │    ├─ onValidationStart()
   │    │    ├─ Project.findByIdAndUpdate (`status: "validating"`) [MongoDB]
   │    │    └─ emitProjectEvent(projectId, "validating", { status: "validating" }) [SSE]
   │    │
   │    ├─ onRepairStart(errors) [if validation issues]
   │    │    ├─ Project.findByIdAndUpdate (`status: "repairing"`) [MongoDB]
   │    │    └─ emitProjectEvent(projectId, "repairing", { status: "repairing", errors }) [SSE]
   │    │
   │    ├─ Phase 4 Granular Self-Repair Callbacks (onRepairStarted, onRepairPlanCreated, etc.)
   │    │    └─ emitProjectEvent(projectId, evtName, data) [SSE] (Not persisted to DB individually)
   │    │
   │    └─ onRequirementVerification(verification)
   │         └─ emitProjectEvent(projectId, "requirement_verification", { verification }) [SSE]
   │
   ├─ Generation Succeeded:
   │    ├─ Project.save (`version = 1`, `status = "visual_verifying"`, `requirementVerification`, `selfRepair`) [MongoDB]
   │    ├─ emitProjectEvent(projectId, "visual_verifying", { status: "visual_verifying", ... }) [SSE]
   │    └─ `waitForClientVisualVerification(projectId, project)` (15-sec timeout)
   │         ├─ If Client reports via POST /api/projects/:id/visual-verification:
   │         │    └─ Project.save (`status: "completed"`, `visualVerification`) [MongoDB]
   │         │    └─ emitProjectEvent(projectId, "completed", { status: "completed", ... }) [SSE]
   │         └─ If Timeout occurs:
   │              └─ Project.save (`status: "completed"`, `visualVerification: { status: "skipped" }`) [MongoDB]
   │              └─ emitProjectEvent(projectId, "completed", { status: "completed", ... }) [SSE]
   │
   └─ Generation Failed (Catch block):
        ├─ Project.findByIdAndUpdate (`status: "failed"`, `error: safeError`) [MongoDB]
        └─ emitProjectEvent(projectId, "failed", { status: "failed", error: safeError }) [SSE]
```

### 2.2 Revision Lifecycle (Code Trace)

```
[Client] AppContext.jsx:handleChat(prompt)
   │ HTTP POST /api/projects/:id/chat { prompt }
   ▼
[Server] chatController.js:chat(req, res)
   ├─ Authenticates user (`req.user.userID`)
   ├─ Project.save (`status: "revising"`, pushes user message) [MongoDB]
   ├─ **MISSING**: No SSE event emitted here!
   ├─ AI search/replace diff application & fallback regeneration
   ├─ Code validation & Phase 4 self-repair loop
   ├─ Failure Gate:
   │    ├─ If failed: Project.save (`status: "completed"`, preserves existing files) [MongoDB]
   │    └─ Returns HTTP 422 JSON with errors
   └─ Success Gate:
        ├─ Project.save (`files = updatedFiles`, `version += 1`, `status: "completed"`) [MongoDB]
        ├─ **MISSING**: No SSE event emitted here!
        └─ Returns HTTP 200 JSON with updated project payload
```

---

## 3. SSE Architecture & Confirmed Capabilities

### 3.1 Server-Side SSE Endpoint: `GET /api/projects/:id/stream`
- **File:** `server/controllers/projectController.js:644-738` (`streamProjectProgress`)
- **Headers:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: text/event-stream
  Cache-Control: no-cache, no-transform
  Connection: keep-alive
  X-Accel-Buffering: no
  ```
- **Initial State Delivery [CONFIRMED]:** Immediately queries MongoDB and writes `formatSSE("initial_state", initialState)`. Contains `status`, `name`, `version`, `designSpec`, `requirementContract`, `requirementVerification`, `filesPlanned`, `filesGenerated`, `currentFile`, and `error`.
- **Terminal State Shortcut [CONFIRMED]:** If the project is already in `completed` or `failed` status upon connection, writes the terminal event and calls `res.end()` immediately.
- **Heartbeat Mechanism [CONFIRMED]:** Sends `: heartbeat\n\n` comment every 15,000ms via `setInterval` to prevent proxy/NAT timeouts.
- **Cleanup on Disconnect [CONFIRMED]:** `req.on("close", ...)` clears the heartbeat timer and unsubscribes the listener from `projectEventBus`.

### 3.2 Event Bus Implementation: `server/services/projectEvents.js`
- **Class:** `ProjectEventEmitter extends EventEmitter` [CONFIRMED]
- **Channel Isolation [CONFIRMED]:** Channels are scoped by project ID: `project:${projectId.toString()}`.
- **Max Listeners:** Explicitly set to 100 via `this.setMaxListeners(100)`.
- **Event Formatting [CONFIRMED]:** `formatSSE(event, data, id = null)` produces W3C standard `id: ...\nevent: ...\ndata: ...\n\n`.

### 3.3 Limitations & Missing Capabilities in SSE

| Capability | Status | Evidence / Code Path | Risk |
| :--- | :--- | :--- | :--- |
| **Event IDs** | **NOT IMPLEMENTED** | `emitProjectEvent` in `projectEvents.js:36` emits `{ event, data, timestamp }` without `id`. | Client cannot determine packet loss or sequence order. |
| **`Last-Event-ID` Header** | **NOT IMPLEMENTED** | `streamProjectProgress` in `projectController.js:644` never reads `req.headers["last-event-id"]`. | Reconnection cannot resume or replay missed events. |
| **Server Replay Buffer** | **NOT IMPLEMENTED** | In-memory `EventEmitter` only broadcasts to active listeners. No ring buffer or log exists. | Events emitted while client is disconnected are permanently lost on the stream. |
| **Revision Events** | **NOT IMPLEMENTED** | `chatController.js` does not import or invoke `emitProjectEvent`. | Multiple tabs or observers receive zero SSE updates during revisions. |
| **Multi-Node Support** | **NOT IMPLEMENTED** | `projectEventBus` is strictly in-process. (Acceptable design for single-instance, but precludes clustering without Redis/broker). | In a multi-process deployment, events emitted on Worker A would not reach a client on Worker B. |

---

## 4. Persistence & State Consistency Map

### 4.1 Persistence Map Across Generation Stages

| Stage / Milestone | Persisted Fields (MongoDB) | In-Memory Only Fields | Method & Trigger | Durability Guarantee |
| :--- | :--- | :--- | :--- | :--- |
| **Initial Request** | `name`, `description`, `status: "pending"`, `version: 0`, `messages` | None | `Project.create` in `createProject` | **Durable** before response |
| **Contract Established** | `requirementContract`, `messages` | None | `Project.findByIdAndUpdate` in `onRequirementContract` | **Durable** immediately |
| **DesignSpec Created** | `designSpec`, `messages` | None | `Project.findByIdAndUpdate` in `onDesignSpec` | **Durable** immediately |
| **File Plan Established** | `status: "generating"`, `name`, `filesPlanned`, `messages` | None | `Project.findByIdAndUpdate` in `onPlan` | **Durable** immediately |
| **File Generation Start** | `currentFile`, `CurrentFile` | None | `Project.findByIdAndUpdate` in `onFileStart` | **Durable** immediately |
| **File Completed** | `files[path]`, `filesGenerated`, `currentFile: null`, `messages` | None | `project.save()` in `onFileComplete` | **Durable** per file completion |
| **Validation Start** | `status: "validating"`, `currentFile: null`, `messages` | None | `Project.findByIdAndUpdate` in `onValidationStart` | **Durable** immediately |
| **Repair Start** | `status: "repairing"`, `messages` | `errors` | `Project.findByIdAndUpdate` in `onRepairStart` | **Durable** immediately |
| **Self-Repair Loop** | None | Repair plans, attempt counts, candidate patches | Emitted via SSE only; not written to DB per attempt | **Transient** until generation completion |
| **Verification Completed** | None | `requirementVerification` result | In-memory in `result` object | **Transient** until generation completion |
| **Visual Verification** | `status: "visual_verifying"`, `version: 1`, `requirementVerification`, `selfRepair`, `visualVerification` | None | `project.save()` in `runBackgroundGeneration` | **Durable** |
| **Visual QA Report/Timeout** | `status: "completed"`, `visualVerification`, `messages` | None | `project.save()` in `waitForClientVisualVerification` / API | **Durable** |
| **Generation Failed** | `status: "failed"`, `error`, `messages` | None | `Project.findByIdAndUpdate` in catch block | **Durable** |
| **Revision Complete** | `files`, `version (+1)`, `status: "completed"`, `requirementContract`, `requirementVerification`, `selfRepair`, `messages` | Candidate contract during generation | `project.save()` in `chatController.js` | **Durable** atomically upon success |

### 4.2 State Consistency Risks
1. **Unpersisted Self-Repair & Verification on Early Termination:**
   If the process crashes during Phase 4 self-repair or requirement verification, `requirementVerification` and `selfRepair` fields are lost from memory because they are only written to MongoDB after `generateProject` returns.
2. **Missing Optimistic Concurrency:**
   `ProjectSchema` does not enforce version-keyed updates (`__v` is not checked). If concurrent operations occur, a slower write can overwrite a newer state.

---

## 5. Server Recovery & Restart Behavior

### 5.1 Startup Recovery Routine
- **File:** `server/server.js:20-43`
- **Implementation:**
  ```javascript
  const result = await Project.updateMany(
    { status: { $in: ["pending", "generating", "validating", "repairing"] } },
    {
      $set: {
        status: "failed",
        error: "Generation was interrupted by a server restart. Please try again.",
      },
      $push: {
        messages: {
          role: "assistant",
          content: "❌ Generation was interrupted by a server restart. Please try creating or regenerating the project.",
          timestamp: new Date(),
        },
      },
    }
  );
  ```

### 5.2 Recovery Gap Analysis

| Scenario | Handled? | Code Behavior | Severity |
| :--- | :--- | :--- | :--- |
| **Crash during `"pending"`, `"generating"`, `"validating"`, `"repairing"`** | **CONFIRMED** | `updateMany` marks status as `"failed"` and appends explanatory message. | Controlled |
| **Crash during `"visual_verifying"`** | **NOT IMPLEMENTED** | `"visual_verifying"` is **absent** from the `$in` list in `server.js:23`. The project remains stuck in `"visual_verifying"` forever. | **CRITICAL (P0)** |
| **Crash during `"revising"`** | **NOT IMPLEMENTED** | `"revising"` is **absent** from the `$in` list in `server.js:23`. The project remains stuck in `"revising"` forever. | **CRITICAL (P0)** |
| **Restart Idempotency** | **CONFIRMED** | Repeated restarts find modified projects already in `"failed"` state; `modifiedCount` is 0. No duplicate errors. | Controlled |
| **Automatic Resumption** | **NOT IMPLEMENTED** | Interrupted jobs are failed, not resumed. (Architecturally sound decision for LLM generation to avoid corrupted state). | Design Choice |
| **Client Reconnection After Restart** | **CONFIRMED** | Client SSE connection drops, falls back to polling or reload; receives `status: "failed"` with clear error message. | Controlled |

---

## 6. Frontend Reconnect & Polling Fallback Behavior

### 6.1 Frontend SSE Implementation
- **File:** `client/src/context/AppContext.jsx:128-418`
- **Subscription Trigger:**
  ```javascript
  const isOngoing =
    status === "generating" || status === "pending" || status === "validating" || status === "repairing" || status === "revising" || status === "visual_verifying";
  ```

### 6.2 The Status Dependency Reconnect Flap (Critical Architecture Flaw)
- **Code:** `AppContext.jsx:418`:
  ```javascript
  }, [activeProject?._id, activeProject?.status, loadProject, user]);
  ```
- **Finding [CONFIRMED]:**
  The `useEffect` dependency array includes `activeProject?.status`.
  Whenever an SSE event arrives that mutates `status`:
  1. `plan` event $\to$ `status = "generating"`
  2. `validating` event $\to$ `status = "validating"`
  3. `repairing` event $\to$ `status = "repairing"`
  4. `visual_verifying` event $\to$ `status = "visual_verifying"`
  
  **Each status change causes React to execute the effect cleanup function (`eventSource.close()`) and re-run the effect, opening a brand-new `EventSource` connection!**
- **Impact:**
  - A standard generation initiates 3 to 5 separate SSE connections sequentially.
  - Server logs multiple connect/disconnect cycles.
  - Potential race condition where an event emitted between the close of socket $N$ and the open of socket $N+1$ is missed.
- **Resolution:** Remove `activeProject?.status` from the dependency array. The SSE connection should be keyed strictly by `activeProject?._id` and `user`.

### 6.3 Polling Fallback (`startFallbackPolling`)
- **Code:** `AppContext.jsx:151-161`:
  ```javascript
  const startFallbackPolling = () => {
    if (fallbackInterval) return;
    fallbackInterval = setInterval(async () => {
      const proj = await loadProject(projectId, true);
      if (proj && (proj.status === "completed" || proj.status === "failed")) {
        clearInterval(fallbackInterval);
        fallbackInterval = null;
        setChatLoading(false);
      }
    }, 3000);
  };
  ```
- **Findings [CONFIRMED]:**
  1. **Unbounded Polling:** If a project gets stuck in `"visual_verifying"` or `"revising"` (e.g. after an unhandled server crash), this interval executes **every 3,000ms indefinitely** until page navigation or reload.
  2. **Cleanup on Terminal State:** Correctly stops polling when status is `"completed"` or `"failed"`.
  3. **Cleanup on Unmount:** Correctly clears interval via `return () => clearInterval(fallbackInterval)`.

---

## 7. MongoDB Test Environment Assessment

### 7.1 Environment Inspection Findings
- **Daemon Availability [CONFIRMED]:** The `mongod` binary exists on the host (`/opt/homebrew/bin/mongod`), but the background service is **not running** and port 27017 is closed (`Error: Couldn't create connection (err=-5): Operation not permitted` / connection refused).
- **In-Memory Server [CONFIRMED]:** `mongodb-memory-server` is **not installed** in `server/package.json`.
- **Existing Test Architecture [CONFIRMED]:** All 403 existing server tests execute in under 24 seconds with zero network calls by stubbing Mongoose model operations (`Project.create`, `Project.findById`, `Project.findByIdAndUpdate`, `Project.updateMany`) using in-memory mock document fixtures.
- **Safety Boundary:** Connecting test suites to a live production or remote Atlas cluster violates containment rules and risks data corruption.
- **Testing Recommendation for Stage 5:**
  Implement Stage 5 tests using high-fidelity in-memory Mongoose model doubles and mock drivers that accurately simulate MongoDB document updates, `$in`, `$push`, `save()`, and network/disconnection errors. Real database durability testing against an external cluster is unavailable and unsafe.

---

## 8. Prioritized Test Gap Matrix for Stage 5

| ID | Priority | Test Category | Target Component / Function | Expected Behavior | Environment |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **T1** | **P0** | Startup Recovery | `server/server.js:20` | Server startup marks orphaned projects in `"visual_verifying"` as `status: "failed"` with restart error message. | In-Memory Mongoose Mock |
| **T2** | **P0** | Startup Recovery | `server/server.js:20` | Server startup marks orphaned projects in `"revising"` as `status: "failed"` with restart error message. | In-Memory Mongoose Mock |
| **T3** | **P0** | Startup Recovery | `server/server.js:20` | Repeated recovery passes are idempotent: already-failed projects are untouched; modifiedCount reflects only newly caught projects. | In-Memory Mongoose Mock |
| **T4** | **P0** | SSE Stream | `projectController.js:streamProjectProgress` | Client connecting mid-generation receives complete `initial_state` snapshot reflecting current DB progress, followed by real-time events. | In-Memory Mock / Test Runner |
| **T5** | **P0** | SSE Stream | `projectController.js:streamProjectProgress` | Client connecting to an already `completed` or `failed` project receives terminal event and stream immediately terminates (`res.end()`). | In-Memory Mock / Test Runner |
| **T6** | **P0** | SSE Stream | `projectController.js:streamProjectProgress` | Client disconnect triggers `req.on("close")`, cleanly unsubscribes event listener, and clears heartbeat timer without memory leaks. | In-Memory Mock / Test Runner |
| **T7** | **P1** | Frontend SSE | `client/src/context/AppContext.jsx:128` | Changing project status during generation does NOT close and recreate the `EventSource` connection. | Mock / Node Test |
| **T8** | **P1** | Frontend Fallback | `client/src/context/AppContext.jsx:151` | Polling fallback triggers when `EventSource` errors, polls every 3s, and terminates when project reaches `completed` or `failed`. | Mock / Node Test |
| **T9** | **P1** | Frontend Fallback | `client/src/context/AppContext.jsx:151` | Polling fallback is bounded by a maximum retry/timeout ceiling (e.g. 120s) and does not poll indefinitely. | Mock / Node Test |
| **T10** | **P1** | Persistence | `projectController.js:runBackgroundGeneration` | Intermediate files are durably saved to MongoDB on each `onFileComplete` so partial progress survives prior to completion. | In-Memory Mongoose Mock |
| **T11** | **P1** | Persistence | `chatController.js:chat` | Revision failure leaves existing `files`, `version`, and `requirementContract` untouched in MongoDB. | In-Memory Mongoose Mock |
| **T12** | **P2** | SSE Heartbeat | `projectController.js:streamProjectProgress` | Heartbeat comments (`: heartbeat\n\n`) are emitted periodically and silently ignore write errors if socket is severed. | Mock / Test Runner |
| **T13** | **P2** | Multi-Subscriber | `projectEvents.js:subscribeProjectEvents` | Multiple concurrent clients subscribed to the same project ID both receive identical progress events without cross-talk. | In-Memory Test |

---

## 9. Minimal Implementation Recommendations

To resolve all identified vulnerabilities without introducing external infrastructure (no Redis, no Kafka, no BullMQ, no rewrites):

### Recommendation 1: Expand Server Startup Cleanup Query
**File:** `server/server.js:23`  
**Action:** Include `"revising"` and `"visual_verifying"` in the `$in` filter array:
```javascript
{ status: { $in: ["pending", "generating", "validating", "repairing", "revising", "visual_verifying"] } }
```

### Recommendation 2: Stabilize Frontend SSE Subscription
**File:** `client/src/context/AppContext.jsx:418`  
**Action:** Remove `activeProject?.status` from the `useEffect` dependency array:
```javascript
// Before:
}, [activeProject?._id, activeProject?.status, loadProject, user]);

// After:
}, [activeProject?._id, loadProject, user]);
```
Inside the effect, check initial status and subscribe once. Track active connection status using an internal `useRef` to prevent redundant teardowns.

### Recommendation 3: Bound Frontend Fallback Polling
**File:** `client/src/context/AppContext.jsx:151`  
**Action:** Add an explicit poll counter or max timeout (e.g., 40 polls $\times$ 3s = 120s max). If exceeded without terminal state, clear interval, set error state, and toast user to reload.

### Recommendation 4: Emit SSE Events During Revisions (Parity)
**File:** `server/controllers/chatController.js`  
**Action:** Emit `emitProjectEvent(project._id, "revising", { status: "revising" })` when revision begins, and emit `completed` / `failed` when revision finishes, providing real-time awareness to observers.

---

## 10. Risks & Limitations

1. **In-Memory Event Bus Limitation:**
   `ProjectEventEmitter` is in-process. If Builder AI is ever scaled horizontally to multiple Express processes behind a load balancer, SSE subscribers connected to Process B will not receive events from generations running on Process A without a shared pub/sub adapter (e.g. Redis). For current single-instance deployment, this is acceptable and optimal for zero-dependency overhead.
2. **Lack of Event Replay:**
   Because there is no ring buffer or `Last-Event-ID` support, a temporary network blip causes the client to miss granular intermediate events (e.g. specific `file_start`). However, upon reconnect, the client receives the authoritative `initial_state` snapshot and, upon completion, `loadProject(projectId, true)` reconciles the entire project from MongoDB.
3. **No Optimistic Locking:**
   Rapid concurrent chat revisions could theoretically produce write collisions in MongoDB.

---

## 11. Recommended Implementation Sequence for Stage 5

1. **Step 1: Test Suite Creation**
   - Implement `server/test/e2e_sse_recovery.test.js` covering P0 and P1 gaps (T1 through T6, T10, T11, T13) using high-fidelity in-memory Mongoose stubs and mock HTTP streams.
2. **Step 2: Server Startup Recovery Hardening**
   - Update `server/server.js` startup cleanup to include `"revising"` and `"visual_verifying"`.
3. **Step 3: Revision SSE Parity**
   - Update `server/controllers/chatController.js` to emit `revising`, `completed`, and `failed` events via `emitProjectEvent`.
4. **Step 4: Client SSE Connection Stabilization & Polling Ceiling**
   - Update `client/src/context/AppContext.jsx` to eliminate the status-flap reconnection cycle and bound polling fallback.
5. **Step 5: Full Regression Gate Execution**
   - Execute the new SSE/Recovery suite, Stage 3 integration suites, Stage 4 browser suites, full server tests (403+), client lint, and client build.
6. **Step 6: Final Stage 5 Reporting**
   - Produce `PHASE_5_STAGE_5_REPORT.md` documenting verified recovery, persistence guarantees, and exact test metrics.

---

## 12. Exact Files Likely to Require Modification in Stage 5

1. `server/server.js` — Expand orphaned project cleanup filter in startup routine.
2. `server/controllers/chatController.js` — Add SSE event emissions for revision lifecycle parity.
3. `client/src/context/AppContext.jsx` — Stabilize `useEffect` SSE subscription and bound fallback polling.
4. `server/test/e2e_sse_recovery.test.js` — New comprehensive Stage 5 test suite.

