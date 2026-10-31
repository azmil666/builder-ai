# P0 BUG FIX REPORT: Sandpack Dependency Resolution & Preview Stability

**Report Date:** November 1, 2026  
**Status:** Resolved & Verified  
**Severity:** P0 (Production Blocker — Live Preview Dependency Crash)  
**Author:** Principal AI & Full-Stack Infrastructure Engineer  

---

## 1. Executive Summary & Root Cause Analysis

### The Failure Symptom
During real local testing of Builder AI with the prompt:
> *"Modern AI developer observability platform"*

The backend generation pipeline reported:
```text
"Website generation complete! You can view and edit the files."
```
However, the live preview in the actual Builder AI editor displayed:
```text
"Something went wrong
Could not fetch dependencies, please try again in a couple seconds:"
```

### Deep-Dive Investigation & Root Causes

Through inspection of the generated project in MongoDB (`projectId: 6ae62dd399a840eebac298fd`), inspection of CodeSandbox's packager CDN endpoints, and simulation of the Sandpack client runtime, we identified five distinct compounding root causes:

#### 1. Fictional SDK Extracted from String Template Literals
In `/components/LiveTelemetryPlayground.js`, the AI generated multiline JavaScript template literals showcasing mock developer code snippets:
```javascript
const SNIPPETS = {
  python: `import os\nfrom synapsellm import monitor...`,
  typescript: `import { SynapseLLM, Guardrails } from '@synapsellm/sdk';\n\nconst synapse = new SynapseLLM({ apiKey: process.env.SYNAPSE_KEY });`
};
```
In `client/src/utils/sandpackUtils.js`, the previous dependency detection used a naive global regular expression over the raw concatenated files:
```javascript
/(?:from\s+['"]([^./][^'"]*)['"])/g
```
This regex matched `'@synapsellm/sdk'` inside the template string literal and added:
```javascript
deps["@synapsellm/sdk"] = "latest";
```
Because `@synapsellm/sdk` is a fictional, non-existent package on npm, CodeSandbox's remote packager failed to build it and threw a 404/500, causing the entire Sandpack client to halt with `"Could not fetch dependencies"`.

#### 2. CodeSandbox CloudFront S3 Packager 403 on `"latest"`
CodeSandbox's packager builds and caches bundles on Amazon CloudFront S3 by exact semver:
- `https://prod-packager-packages.codesandbox.io/v2/packages/lucide-react/0.469.0.json` $\rightarrow$ **200 OK** (instant cache hit)
- `https://prod-packager-packages.codesandbox.io/v2/packages/lucide-react/latest.json` $\rightarrow$ **403 AccessDenied** (cache miss requiring unpkg/npm live build)

Builder AI previously defaulted all extracted dependencies to `"latest"`:
```javascript
deps[pkg] = "latest";
```
When CodeSandbox's live packager suffered network latency, rate limits, or S3 cache misses on `"latest"`, the preview failed intermittently.

#### 3. Object `{ content: code }` Stringification Bug
When files were updated dynamically during streaming generation or revision, `files` was passed as an object containing `{ content: string }` instead of plain strings.
The previous `sandpackUtils.js` performed:
```javascript
const allCode = Object.values(files).join("\n");
```
When `files` contained objects, this evaluated to `"[object Object]\n[object Object]"`, preventing dependency detection from finding any imports at all.

#### 4. Lack of Server-Side Dependency Preflight & Missing Canonical `/package.json`
The backend validation pipeline in `server/services/codeValidator.js` validated JSX syntax, component contracts, and Lucide icon names, but did **not** perform an end-to-end dependency preflight check:
- It never synthesized a canonical `/package.json` with pinned versions.
- It did not validate semver specifications or package name formats.
- Projects were saved to MongoDB and served to the client without verifying whether their dependency manifests were resolvable in Sandpack.

#### 5. Silent Preview Crash Without Actionable Error Diagnostics
When CodeSandbox failed to fetch a dependency, `SandpackErrorMonitor.jsx` suppressed the error or displayed a generic message without identifying the broken package name or allowing the user to retry or ignore the unresolvable package.

---

## 2. Engineering Solution & Implementation

### A. Client-Side Sizing, Detection & Resilience (`client/src/utils/sandpackUtils.js`)
- **AST / Pre-Processed Import Scanner:** Before scanning for ES module imports, comments (`/* ... */`, `// ...`) and template literals (`` `...` ``) are cleanly stripped from the code. Mock code snippets in string literals are completely ignored.
- **Support for Both Object and String Formats:** Seamlessly handles both `{ "/App.js": "..." }` and `{ "/App.js": { content: "..." } }`.
- **Pinned CDN Cache Versions:** Replaced `"latest"` with verified, pre-cached semver versions from `DEFAULT_PACKAGE_VERSIONS`:
  - `react`: `^18.3.1`
  - `react-dom`: `^18.3.1`
  - `lucide-react`: `^0.469.0`
  - `framer-motion`: `^11.15.0`
  - `recharts`: `^2.15.0`
  - `canvas-confetti`: `^1.9.3`
  - `clsx`: `^2.1.1`
  - `tailwind-merge`: `^2.6.0`
  - `date-fns`: `^3.6.0`
  - `moment`: `^2.30.1`
  - `lodash`: `^4.17.21`
  - `zustand`: `^4.5.5`
  - `axios`: `^1.7.9`
  - `prismjs`: `^1.29.0`
- **Validation Primitives:** Exported `isValidNpmPackageName` and `validateDependenciesMap`.

### B. User-Facing Diagnostics & Interactive Recovery (`PreviewPanel.jsx`, `SandpackErrorMonitor.jsx`, `FullPagePreview.jsx`)
- **Intelligent Error Monitor:** `SandpackErrorMonitor` parses Sandpack runtime messages and extracts the exact failing package name using targeted regexes (`/Could not fetch dependencies/`, `/package '([^']+)'/`).
- **Dependency Resolution Error Overlay:** When a dependency fails to fetch, an interactive banner appears directly over the canvas:
  - Displays the exact package that failed: `Failed to resolve package: @synapsellm/sdk`.
  - Explains the cause: `Package not found on npm or failed to build on CodeSandbox CDN.`
  - **"Retry Resolution" Button:** Increments a `refreshKey` to force Sandpack to re-attempt resolution without losing user code.
  - **"Ignore & Preview" Button:** Adds the failing package to `ignoredPackages`, excluding it from the Sandpack dependencies object so the rest of the application can render immediately.

### C. Server-Side Dependency Preflight (`server/services/codeValidator.js`)
- **`validateProjectDependencies(files)`:** Added as Step 7 in the project validation lifecycle:
  1. Gathers external imports across all `.js`/`.jsx` files using AST and template-literal-safe fallbacks.
  2. Inspects `/package.json`: if missing, automatically synthesizes a canonical `/package.json` with pinned versions of `react`, `react-dom`, and all imported libraries.
  3. Validates package names against npm naming rules and `FORBIDDEN_CLIENT_MODULES` (blocking `fs`, `child_process`, `express`, etc.).
  4. Validates semver version specs with `isValidSemverSpec`.
  5. Auto-normalizes `"latest"` to pinned versions.
  6. Emits structured errors (`dependency_forbidden`, `dependency_invalid_name`, `dependency_invalid_version`, `dependency_undeclared`).
- **Lucide Import Regex Fix:** Fixed `importRegex` in `validateAndFixLucideIcons` from `/import\s*\{([\s\S]*?)\}\s*from\s*['"]lucide-react['"];?/g` to `/import\s*\{([^}]*)\}\s*from\s*['"]lucide-react['"];?/g`. This prevents the greedy quantifier from bleeding into preceding import statements across different packages (such as `recharts` or `framer-motion`).

---

## 3. Verification & Automated Test Results

### Dedicated Test Suite: `server/test/dependency_resolution.test.js`
All 20 test cases pass with zero failures:
1. `Validates standard, scoped, and unscoped npm package names` (PASS)
2. `Rejects invalid npm package names` (PASS)
3. `Rejects forbidden Node.js built-ins and server packages` (PASS)
4. `Validates semver version specifications and ranges` (PASS)
5. `Rejects malformed semver strings` (PASS)
6. `Ignores mock import statements inside string template literals (LiveTelemetryPlayground)` (PASS)
7. `Client detectDependencies also ignores mock imports in template literals` (PASS)
8. `Synthesizes canonical /package.json with pinned versions when missing` (PASS)
9. `Normalizes 'latest' to pinned versions to prevent CodeSandbox 403 cache misses` (PASS)
10. `Detects malformed /package.json syntax` (PASS)
11. `Rejects forbidden Node.js modules imported in client components` (PASS)
12. `Flags undeclared and unsupported external packages` (PASS)
13. `Flags invalid semver version specifications in package.json` (PASS)
14. `detectDependencies processes both plain string code and object { content } format` (PASS)
15. `validateDependenciesMap flags forbidden or invalid packages and warns on unpinned latest` (PASS)
16. `Target Project 1: AI Developer Observability Platform (exact DB project 6ae62dd399a840eebac298fd)` (PASS)
17. `Target Project 2: Luxury Ceramics E-commerce with cart drawer and pricing calculations` (PASS)
18. `Target Project 3: Minimal Single-Page Landing Site` (PASS)
19. `Target Project 4: Lucide Icons Gallery with multiple modern icons` (PASS)
20. `Target Project 5: Multi-dependency project with charts, animations, and confetti` (PASS)

### Full Backend Test Suite
```bash
> node --test test/**/*.test.js
ℹ tests 223
ℹ suites 88
ℹ pass 223
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 3388ms
```

### Client Production Build & Lint
```bash
> client@0.0.0 lint (oxlint)
Found 0 errors.

> client@0.0.0 build (vite build)
✓ built in 416ms
```

---

## 4. Acceptance Testing Summary

| Test Scenario | Project Scope | Key Risk Tested | Result |
|---|---|---|---|
| **Target Project 1** | Modern AI developer observability platform (`6ae62dd399a840eebac298fd`) | Mock code snippet containing `@synapsellm/sdk` inside template string | **PASSED** — Mock import ignored, pinned `lucide-react@^0.469.0` resolved cleanly |
| **Target Project 2** | Editorial luxury ceramics e-commerce storefront | CartDrawer with storeConfig and Lucide icons | **PASSED** — Pinned `react@^18.3.1`, prop contracts valid |
| **Target Project 3** | Minimal single-page landing site | Zero external dependencies | **PASSED** — Default React 18 dependencies auto-synthesized |
| **Target Project 4** | Lucide icons gallery | High density of Lucide icon imports | **PASSED** — Verified against installed Lucide icons set |
| **Target Project 5** | Multi-dependency analytics dashboard | `recharts`, `framer-motion`, `canvas-confetti`, `lucide-react` simultaneously | **PASSED** — Zero cross-package regex bleeding, all pinned versions resolved |

---

## 5. Architectural Guardrails & Future Roadmap

1. **Self-Contained Fallback Bundler:** In future phases, consider evaluating an optional in-browser Rolldown / esm.sh fallback bundler when CodeSandbox's packager CDN is unreachable in offline or restricted environments.
2. **Version Pinning Synchronization:** Any additions to supported AI generation packages should define matching pinned versions in both `client/src/utils/sandpackUtils.js` and `server/services/codeValidator.js`.
3. **No Unpinned `"latest"` Allowed:** The server-side and client-side preflight checks now strictly normalize `"latest"` to verified semver versions, ensuring high CDN cache-hit rates.

