# Builder AI — Phase 5 Stage 4 Assessment
## Real Browser Functional & Responsive Verification Architecture

**Document Version:** 1.0.0  
**Phase:** Phase 5 Stage 4 (Real Browser Functional & Responsive Verification)  
**Author:** Senior Browser Automation Engineer & QA Architect  
**Date:** November 6, 2026  
**Git Branch:** `engine`  
**Status:** READ-ONLY ASSESSMENT (Awaiting Approval Before Implementation)  

---

## 1. Executive Summary & Objective

Phase 5 Stage 3 successfully integrated and remediated the website generation and multi-turn revision lifecycle test suites (14/14 tests passing in ~420ms, 373 total server tests passing). However, static AST verification and code compilation alone cannot prove that a generated website actually functions correctly in a real browser engine.

The objective of **Phase 5 Stage 4** is to implement deterministic, automated browser verification that executes generated websites inside **real headless Google Chrome**, proving:
1. **Actual DOM Rendering:** Complete React component tree mounts and renders without blank screens or hydration panics.
2. **Interactive Functionality:** Buttons, navigation anchors, drawers, search inputs, tabs, and cart quantity controls respond to user interaction and produce observable DOM mutations.
3. **Form Submissions & Feedback:** Forms accept text, trigger validation on submit, and render feedback messages.
4. **Search & Dynamic Filtering:** Controlled inputs bind to state, filter collections, display dedicated empty states, and restore items on clear.
5. **Multi-Step Cart Lifecycle:** Products are added to cart, cart drawer opens, quantities increment/decrement, subtotals recalculate with accurate math, and items can be removed.
6. **Responsive Layout & 0px Overflow:** Verification across Desktop (1440×900), Tablet (768×1024), and Mobile (375×812) viewports asserting:
   $$\text{document.documentElement.scrollWidth} \le \text{document.documentElement.clientWidth}$$
7. **Console Hygiene & Exception Trapping:** Capture of all browser `console.error` logs, unhandled exceptions, and runtime rendering failures.

---

## 2. Review of Existing Test & Browser Infrastructure

### 2.1 Available Browser Runtime
- **Browser Binary:** Google Chrome is installed and verified on macOS at:
  `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- **Installed Version:** `Google Chrome 156.0.8078.80` (Modern stable Chromium engine).
- **Architecture:** `x86_64` / `arm64` binary on macOS Darwin.

### 2.2 Existing Browser Script (`server/test/browser_acceptance.js`)
An existing script created in Phase 2D was audited:
- **Strengths:**
  - Packages generated React code with `/styles.css`, `index.html`, and `main.jsx`.
  - Compiles the bundle programmatically using Vite (`client/node_modules/vite`) and `@vitejs/plugin-react` in ~400ms.
  - Successfully launches headless Chrome (`--headless=new`) and captures screenshots.
- **Shortcomings & Gaps Identified:**
  1. **String-Matching "Interactions":** Lines 312–321 of `browser_acceptance.js` checked code strings (e.g. `appCode.includes("setCart")`) rather than actually clicking buttons or asserting browser DOM mutations.
  2. **Static Viewport Screenshots Only:** Did not assert `scrollWidth <= clientWidth` inside the live browser session.
  3. **No Interactive Protocol:** Used CLI `--screenshot` flags rather than a bidirectional communication protocol, preventing multi-step interactions (e.g. type search $\to$ verify filtered DOM $\to$ click clear $\to$ verify restored DOM).
  4. **macOS Minimum Window Width Limit:** Running Chrome CLI with `--window-size=375,812` on macOS without mobile emulation yields an effective `innerWidth` of 500px due to macOS windowing minimums. Real mobile testing requires Chrome DevTools Protocol (CDP) `Emulation.setDeviceMetricsOverride`.

### 2.3 Available Node.js Runtime Capabilities
- **Node.js Version:** `v25.3.0`.
- **Native WebSocket Support:** Node v25 includes global native `WebSocket` support (`typeof WebSocket === "function"`).
- **Implication:** Node.js can connect directly to Google Chrome's Chrome DevTools Protocol (CDP) over a local WebSocket without requiring `ws`, `puppeteer`, or `playwright`.

### 2.4 Existing Helper Utilities (`server/services/visualQa.js`)
- `getBrowserMetricExtractionScript()` provides a ready-to-inject DOM extraction script measuring `scrollWidth`, `clientWidth`, `headings`, `images`, and `emptySections`.
- `analyzeProjectVisualQuality()` and `evaluateRenderedVisualQuality()` provide structured validation rules for visual quality scores.

---

## 3. Technology Evaluation: External Libraries vs. Native CDP Harness

| Evaluation Criteria | Option A: Playwright / Puppeteer | Option B: CLI-only Chrome (`--dump-dom`) | Option C: Native Lightweight CDP Harness |
| :--- | :--- | :--- | :--- |
| **Dependency Footprint** | Heavy (+150MB to +400MB node_modules, Chromium binary download) | Zero new dependencies | **Zero new dependencies** (uses installed Chrome + Node v25 native WebSocket) |
| **Interactive Capabilities** | Full (Click, Type, Wait, Evaluate) | None (Single static snapshot per execution) | **Full** (`Runtime.evaluate`, `Input.dispatchMouseEvent`, `Emulation.setDeviceMetricsOverride`) |
| **Mobile Emulation (<500px)** | Supported | **Broken on macOS** (Clamped to 500px minimum window width) | **Supported** via `Emulation.setDeviceMetricsOverride({ mobile: true, width: 375, height: 812 })` |
| **Console & Error Trapping** | Supported | Fragile (CLI stderr only) | **Native CDP Events** (`Runtime.consoleAPICalled`, `Runtime.exceptionThrown`) |
| **Execution Speed** | Moderate (~2-3s setup overhead) | Fast (~1s per snapshot) | **Fast & Lightweight** (~300ms connection, sub-second execution) |
| **Sandboxing & Isolation** | Requires sandbox elevation for child process & sockets | Sandboxed CLI | Requires loopback socket connection (`127.0.0.1`) |
| **Verdict** | **REJECTED** (Violates constraint against unnecessary dependencies) | **REJECTED** (Cannot test interactive clicks or mobile viewports) | **RECOMMENDED & FULLY CAPABLE** |

### Assessment Verdict:
The existing Google Chrome installation (`Google Chrome 156.0.8078.80`) combined with Node.js v25's native `WebSocket` and Vite's programmatic compiler provides **100% of the capabilities required for Stage 4 without installing Playwright, Puppeteer, or any new dependencies**.

---

## 4. Proposed Stage 4 Test Architecture

The proposed browser verification architecture consists of four tightly integrated, zero-dependency modules:

```mermaid
flowchart TD
    subgraph TestRunner [Node.js Native Test Runner (node:test)]
        F1[e2e_browser_functional.test.js]
        F2[e2e_responsive_qa.test.js]
    end

    subgraph CompilerModule [Programmatic Preview Compiler]
        Vite[Vite Programmatic Build API]
        ReactPlugin[@vitejs/plugin-react]
        TempBundle[/tmp/builder-ai-preview-bundle/dist]
        Vite --> ReactPlugin --> TempBundle
    end

    subgraph LocalServer [Ephemeral Static HTTP Server]
        HttpServer[Node.js http.createServer]
        HttpServer -->|Serves dist on 127.0.0.1:0| Browser
    end

    subgraph NativeCdpHarness [Native Chrome CDP Harness]
        ChromeProc[spawn Google Chrome --headless=new --remote-debugging-port=0]
        PortFile[DevToolsActivePort File]
        WS[Native Node.js WebSocket Client]
        ChromeProc --> PortFile --> WS
    end

    subgraph RealBrowser [Google Chrome 156 Headless Engine]
        Browser[Live Web Page Context]
        WS -->|Emulation.setDeviceMetricsOverride| Browser
        WS -->|Page.navigate| Browser
        WS -->|Runtime.evaluate - Click / Type| Browser
        WS -->|Runtime.consoleAPICalled / exceptionThrown| TestRunner
        Browser -->|DOM Mutations & scrollWidth / clientWidth| WS
    end

    TestRunner --> CompilerModule
    CompilerModule --> LocalServer
    TestRunner --> NativeCdpHarness
```

### 4.1 Module 1: Programmatic Vite Preview Compiler
- Operates on deterministic project files (`files` object).
- Writes temporary bundle into `/tmp/builder-ai-browser-tests/<fixture-id>/`.
- Invokes `vite.build({ root, base: "./", plugins: [reactPlugin()], logLevel: "error" })` programmatically in ~400ms.
- Yields a production-compiled, tree-shaken static bundle containing `index.html`, compiled React JS, and Tailwind CSS.

### 4.2 Module 2: Ephemeral In-Memory Static HTTP Server
- Uses Node.js built-in `http.createServer`.
- Binds to `127.0.0.1:0` (dynamic free OS port).
- Serves static files with correct MIME types (`text/html`, `application/javascript`, `text/css`).
- Eliminates browser `file://` cross-origin security restrictions and ES module origin blockers.
- Cleanly closes in test teardown (`server.close()`).

### 4.3 Module 3: Native Chrome CDP Client (`server/test/helpers/cdpHarness.js`)
A minimal, robust (~160 lines) helper that:
1. Spawns `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` with:
   - `--headless=new`
   - `--remote-debugging-port=0` (dynamic port assigned by OS)
   - `--user-data-dir=/tmp/chrome-test-profile-<timestamp>`
   - `--no-sandbox --disable-gpu --disable-dev-shm-usage`
2. Reads the assigned port and WebSocket path from `/tmp/chrome-test-profile-<timestamp>/DevToolsActivePort`.
3. Connects via native Node.js `WebSocket('ws://127.0.0.1:<port><path>')`.
4. Provides high-level async primitives:
   - `navigate(url)`: Navigates and awaits `Page.loadEventFired`.
   - `setViewport(width, height, isMobile)`: Calls `Emulation.setDeviceMetricsOverride`.
   - `evaluate(expression)`: Calls `Runtime.evaluate({ expression, awaitPromise: true, returnByValue: true })`.
   - `click(selector)`: Dispatches real mouse events (`pointerdown`, `mousedown`, `mouseup`, `click`) or invokes `el.click()`.
   - `type(selector, text)`: Sets `input.value = text` and dispatches `input` and `change` events with `bubbles: true`.
   - `getConsoleErrors()`: Returns intercepted `console.error` and unhandled exception traces.
   - `close()`: Closes WebSocket and kills the Chrome process with SIGKILL, removing the temp profile directory.

---

## 5. Test Suite Specifications & Fixture Scenarios

### 5.1 Test Suite 1: Functional Browser Interactions (`e2e_browser_functional.test.js`)

| Fixture | Scenario | Concrete Browser Interaction | Observable DOM Assertion |
| :--- | :--- | :--- | :--- |
| **Fixture A (Portfolio)** | Navigation Links | Click `<a href="#projects">Projects</a>` | `window.scrollY` changes to match `#projects` element offset. |
| **Fixture A (Portfolio)** | Mobile Menu Drawer | Set viewport 375×812; click mobile hamburger button | Mobile nav menu changes from hidden to visible; nav items become visible. |
| **Fixture A (Portfolio)** | Contact Form Feedback | Type name, email, message; click "Send Inquiry" button | Form displays confirmation message (`"Message sent successfully!"`). |
| **Fixture B (SaaS Landing)** | Billing Pricing Toggle | Click "Annual Billing" toggle button | Displayed pricing values update (e.g. `$29/mo` updates to `$290/yr` or discounted value). |
| **Fixture B (SaaS Landing)** | Email Signup Input | Type `"user@example.com"`; click "Get Started" | Success confirmation or state message rendered in DOM. |
| **Fixture C (Directory)** | Search Filtering | Type `"Design"` into search input | Filtered list updates: matching items remain visible, non-matching items removed. |
| **Fixture C (Directory)** | Empty Search State | Type `"NON_EXISTENT_QUERY_XYZ"` | Directory grid displays dedicated "No results found" empty state container. |
| **Fixture C (Directory)** | Search Reset | Clear search input value | All original directory items are restored in the DOM. |
| **Fixture D (Storefront)** | Add to Cart | Click "Add to Bag" on first product card | Cart badge counter increments from 0 to 1; item appears in cart drawer. |
| **Fixture D (Storefront)** | Cart Drawer Open | Click Cart Icon in navbar | `CartDrawer` container transitions to open/visible state in DOM. |
| **Fixture D (Storefront)** | Quantity Increment & Math | Inside CartDrawer, click `+` quantity button | Quantity increments ($1 \to 2$); subtotal updates to exact calculated sum (`price * 2`). |
| **Fixture D (Storefront)** | Quantity Decrement / Remove | Inside CartDrawer, click `-` or remove button | Item quantity decrements or item is removed; subtotal recalculates. |
| **Fixture D (Storefront)** | Empty Cart State | Remove all items from cart | Cart drawer displays "Your cart is empty" state. |

---

### 5.2 Test Suite 2: Responsive QA & Overflow Verification (`e2e_responsive_qa.test.js`)

#### Viewport Matrix:
- **Desktop:** $1440 \times 900$ (Standard desktop browser)
- **Tablet:** $768 \times 1024$ (iPad / tablet viewport)
- **Mobile:** $375 \times 812$ (iPhone / modern mobile viewport)

#### Strict Verification Assertions Across All 4 Fixtures:
1. **Zero Horizontal Document Overflow:**
   $$\text{document.documentElement.scrollWidth} \le \text{document.documentElement.clientWidth}$$
   Any document horizontal overflow $> 0\text{px}$ fails the test immediately.
2. **Sequential Section Layout (No Vertical Collisions):**
   Sections (`header`, `hero`, `features`, `projects`, `footer`) must have non-overlapping bounding rects:
   $$\text{rect}_{i+1}.\text{top} \ge \text{rect}_i.\text{top} - 1$$
3. **Interactive Element Accessibility:**
   Primary CTAs, inputs, and navigation buttons must have positive dimensions (`width > 0`, `height > 0`) and remain within `clientWidth`.
4. **Console Hygiene:**
   Zero unhandled exceptions or React runtime errors captured during rendering across any of the viewports.

---

## 6. Process Lifecycle & Teardown Safety Guarantees

To ensure 100% clean test execution without orphaned processes, port conflicts, or filesystem leaks:
1. **Dynamic Port Binding:** Local static HTTP servers bind to port `0`, letting the OS assign an unused ephemeral port.
2. **Dynamic Chrome Port:** Chrome starts with `--remote-debugging-port=0`, preventing port collision with any local debugging sessions.
3. **Isolated User Data Directories:** Every test suite allocates `/tmp/chrome-test-profile-<pid>-<timestamp>` and purges it recursively in `after()` or `finally` blocks.
4. **Guaranteed Process Termination:** The CDP harness registers process `exit` hooks and explicit `try ... finally { await harness.close(); }` blocks calling `chrome.kill("SIGKILL")`.
5. **No Network Leaks:** Tests communicate strictly with `127.0.0.1`; zero external network requests are made.

---

## 7. Execution & Quality Gate Plan

Following approval of this assessment, Stage 4 implementation will be executed and validated against:
1. `node --test server/test/e2e_browser_functional.test.js`
2. `node --test server/test/e2e_responsive_qa.test.js`
3. `node --test server/test/e2e_generation_pipeline.test.js server/test/e2e_revision_lifecycle.test.js` (Stage 3 suites)
4. `npm --prefix server test` (Full server test suite, preserving all 373 existing tests)
5. `npm --prefix client run lint` (Client oxlint)
6. `npm --prefix client run build` (Client production Vite build)

---

## 8. Summary & Recommendation

- **Technical Viability:** 100% feasible using existing Google Chrome 156 + Node.js v25 native WebSocket + Vite programmatic builder.
- **Dependency Impact:** **Zero new dependencies**. No Playwright or Puppeteer required.
- **Test Fidelity:** Replaces previous string-matching heuristics with real, observable browser DOM interactions and real viewport dimension measurements.
- **Next Step:** Awaiting review and approval of this assessment before creating `server/test/helpers/cdpHarness.js`, `server/test/e2e_browser_functional.test.js`, and `server/test/e2e_responsive_qa.test.js`.

