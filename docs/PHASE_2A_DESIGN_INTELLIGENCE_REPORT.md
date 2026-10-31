# Builder AI — Phase 2A: Design Intelligence Engine Report

**Status:** Completed & Verified  
**Date:** 2026-10-31  
**Milestone:** Phase 2A — Design Intelligence Engine  
**Test Suite Status:** 38/38 passing (100% green across Phase 1A, 1B, and 2A)

---

## 1. Executive Summary

Prior to Phase 2A, Builder AI operated on a flat, direct planning pipeline:
```
User Prompt → File Planning → Code Generation
```
Components generated in isolation without visual identity constraints, leading to:
- Sibling components inventing disjoint palettes (e.g. Hero using indigo, Features using emerald, CTA using amber).
- Inconsistent typographic scales, missing Google Font declarations, and ad-hoc CSS styles.
- Generic, boilerplate card interfaces rather than distinct, archetype-aligned design languages.

In **Phase 2A**, we established a **Design Intelligence Engine** that precedes technical planning and code construction:
```
User Prompt
  ↓
Stage 1: DesignSpec Generation (Zod-validated design system & archetype definition)
  ↓
Stage 2: Technical File Planning (informs component breakdown, contracts & style tokens)
  ↓
Stage 3: Foundation Code Generation (/styles.css generated first with design tokens & Google Fonts)
  ↓
Stage 4: Modular Component Generation (all components align with DesignSpec & /styles.css)
```

Existing projects without saved `designSpec` documents continue to load, edit, and export smoothly through backward-compatible Mongoose defaults (`null`).

---

## 2. Architecture & DesignSpec Schema (`server/services/aiSchemas.js`)

A formal, strongly typed `DesignSpecSchema` was defined using Zod. It specifies aesthetic, typographic, color, spatial, navigational, and motion directives:

| Section | Keys & Types | Purpose |
| :--- | :--- | :--- |
| **Identity & Category** | `purpose`, `targetAudience`, `category` (enum) | Establishes the purpose of the site (`saas_landing`, `interactive_app`, `agency_portfolio`, `ecommerce`, `editorial_blog`, `restaurant_hospitality`, `developer_tools`, `personal_brand`, `utility_game`, `other`). |
| **Archetype & Tone** | `visualDirection`, `archetype` (enum), `brandPersonality` | Governs the structural mood (`clean_modern`, `dark_luxury`, `editorial_magazine`, `swiss_international`, `neo_brutalism`, `bento_grid`, `minimal_utility`). |
| **Color Tokens** | `colorPalette` (`theme`, `bg`, `fg`, `muted`, `line`, `accent`, `accentForeground`, `cardBg`, `cardBorder`) | Strict, cohesive hex color tokens injected into CSS variables and component utility classes. |
| **Typography Pairing** | `heading`, `body`, `mono`, `fontImportUrl` | Curated Google Font pairings (e.g. *Plus Jakarta Sans* + *Inter*, *Playfair Display* + *Inter*, *Space Grotesk* + *JetBrains Mono*) with verified CDN import URLs. |
| **Layout & Spacing** | `containerWidth`, `sectionPadding`, `gap`, `structure` | Dictates layout density, container bounds (`max-w-7xl`, `max-w-4xl`), and vertical cadence. |
| **Component Styling** | `cardRadius`, `buttonRadius`, `shadow`, `borderStyle`, `cardStyle` | Standardizes corner radii, borders, shadows, and card classes across all child files. |
| **Navigation & Hero** | `navigation` (`type`, `details`), `hero` (`composition`, `headline`, `subheadline`, `ctaText`, `details`) | Directs the header style (`sticky_header`, `minimal_bar`, `floating_island`) and hero presentation (`centered`, `split`, `interactive_canvas`). |
| **Media & Icons** | `mediaDirection` (`type`, `description`, `imageTreatment`, `iconStyle`) | Mandates modern inline SVG icons via `lucide-react` (eliminating broken Font Awesome CDN dependencies). |
| **Motion Strategy** | `strategy`, `keyframes`, `reducedMotion` | Specifies CSS keyframe animations (e.g., `fadeInUp`, `float`) and enforces `prefers-reduced-motion` safety. |
| **Responsive & A11y** | `responsive` (`breakpoints`, `mobileStrategy`), `accessibility` (`contrastRatio`, `focusRings`, `semanticElements`) | Mandates mobile-first fluid behavior and WCAG 2.2 AA contrast compliance. |
| **Signature Hook** | `signature` (string) | The unique, memorable visual hallmark distinguishing the site from generic templates. |

---

## 3. Intelligent Generation & Fallback Pipeline (`server/services/ai.js`, `server/services/prompts.js`)

### 3.1 DesignSpec Generation
During `generateProject(prompt, callbacks)`:
1. Stage 1 invokes `generateObject` with `DesignSpecSchema` and `DESIGN_SPEC_SYSTEM`.
2. A timeout / retry failure or malformed payload triggers `createDefaultDesignSpec(prompt)`:
   - For interactive utilities, games, or calculators: automatically activates `interactive_app` with `minimal_utility` archetype, compact layout, and direct canvas/state architecture.
   - For dark/night keywords: automatically selects dark luxury tokens (`#09090b` canvas, `#18181b` card surfaces, vibrant violet accent).
   - For standard SaaS/marketing requests: selects `clean_modern` with crisp typography and card tokens.
3. The generated specification triggers the `callbacks.onDesignSpec(designSpec)` callback, broadcasting the design concept to the database and chat log.

### 3.2 Design-Aware File Planning
The file planner (`buildFilePlanSystem(designSpec)`) receives the established `DesignSpec`:
- Injects archetype constraints, color tokens, and Google Font `@import` directives into the planner prompt.
- Enforces category-appropriate file structures (single `/App.js` for games/utilities; modular component hierarchies for multi-section landing pages).
- Emits explicit `imports` and `exports` contracts for every planned file.

### 3.3 Foundation Code Generation
To prevent sibling components from generating blind to styles:
1. **Foundation First:** If `/styles.css` is in the plan, it is generated **first** (Phase 3a).
2. The generated `/styles.css` is added to `alreadyGeneratedFiles`, making root CSS variables (`--color-primary`, `--color-accent`) and custom animations available to all downstream components.
3. **Parallel Safe Execution:** Sibling components (Phase 3b) generate with full awareness of `alreadyGeneratedFiles` and the active `designSpec`.
4. **Reliable Icons:** Prompts mandate `lucide-react` imports (e.g. `import { ArrowRight, Check } from 'lucide-react'`), preventing hallucinated icon CDNs.

---

## 4. Database Persistence & Backward Compatibility (`server/models/Project.js`, `server/controllers/projectController.js`)

- **Schema Update:** `designSpec: { type: Schema.Types.Mixed, default: null }` added to `ProjectSchema`.
- **Legacy Record Safety:**
  - Existing projects in MongoDB without `designSpec` load with `designSpec: null`.
  - `getProject` returns `designSpec: project.designSpec || null`.
  - Sandpack preview and zip export continue to function without modification because Sandpack only relies on `project.files`.
  - Conversational revision (`reviseProject`) remains fully compatible.
- **Progress Tracking:**
  - `runBackgroundGeneration` records `designSpec` via `onDesignSpec` callback immediately upon establishment.
  - An assistant message is appended to `project.messages`:  
    `"Design concept established: **[Direction]** ([Archetype] archetype) with palette ([Primary], [Accent])."`

---

## 5. Verification & Test Evidence

### 5.1 Automated Test Suites
Run via `npm test --prefix server`:
```text
▶ Phase 1A: Core Functionality Stabilization Tests
  ✔ Task 1: Authentication Session Persistence (4 tests pass)
  ✔ Task 2: Conversational Revision Authorization (1 test pass)
  ✔ Task 3: AI Generation Fallback & Sensitive Data Redaction (2 tests pass)
  ✔ Task 4: Database Schema Consistency (2 tests pass)
✔ Phase 1A: Core Functionality Stabilization Tests (8.1ms)

▶ Phase 1B: Security Hardening & Regression Suite
  ✔ Task 1: JWT Secret Handling & Startup Safety (4 tests pass)
  ✔ Task 2: Rate Limiting Enforcement (2 tests pass)
  ✔ Task 3: Project Access Control & Ownership Enforcement (4 tests pass)
  ✔ Task 4: Conversational Revisions & Diff Engine Regression (2 tests pass)
  ✔ Task 5: Sensitive Data Sanitization (1 test pass)
✔ Phase 1B: Security Hardening & Regression Suite (7.1ms)

▶ Phase 2A: Design Intelligence Engine Tests
  ▶ Task 1: DesignSpec Schema Validation
    ✔ successfully parses a comprehensive DesignSpec (3.1ms)
    ✔ rejects an invalid archetype enum value (0.7ms)
    ✔ rejects an invalid colorPalette theme (0.2ms)
    ✔ applies default values for optional nested structures when omitted (0.2ms)
  ✔ Task 1: DesignSpec Schema Validation (4.7ms)
  ▶ Task 2: Default DesignSpec Fallback & AI Planning Integration
    ✔ generates a valid, schema-compliant fallback DesignSpec for game/interactive prompt (0.8ms)
    ✔ generates a valid, schema-compliant fallback DesignSpec for SaaS/fintech prompt (0.6ms)
    ✔ buildFilePlanSystem embeds DesignSpec rules, tokens and fonts into planner prompt (0.2ms)
    ✔ buildFilePlanSystem gracefully handles null designSpec (0.1ms)
  ✔ Task 2: Default DesignSpec Fallback & AI Planning Integration (1.9ms)
  ▶ Task 3: Code Generation Prompt with DesignSpec & Shared Contracts
    ✔ buildFileCodeSystem injects Google Fonts, token directives and Lucide guidelines (0.2ms)
    ✔ buildFileCodeSystem handles null designSpec without error (0.1ms)
  ✔ Task 3: Code Generation Prompt with DesignSpec & Shared Contracts (0.4ms)
  ▶ Task 4: File Plan and GenerationResult Schema Backward Compatibility
    ✔ validates FilePlanSchema with import/export contracts (0.5ms)
    ✔ validates GenerationResultSchema with designSpec present (1.2ms)
    ✔ validates GenerationResultSchema without designSpec (legacy compatibility) (0.2ms)
  ✔ Task 4: File Plan and GenerationResult Schema Backward Compatibility (1.9ms)
  ▶ Task 5: Mongoose Model Persistence & Backward Compatibility
    ✔ Project model stores designSpec and defaults to null on legacy documents (4.1ms)
    ✔ Project model persists complete DesignSpec when provided (0.6ms)
    ✔ supports updating designSpec on an existing document (0.8ms)
  ✔ Task 5: Mongoose Model Persistence & Backward Compatibility (5.7ms)
✔ Phase 2A: Design Intelligence Engine Tests (16.4ms)

Total: 38 tests, 17 suites, 38 passed, 0 failed, 0 skipped.
```

### 5.2 Client Verification
- `npm run lint --prefix client`: Passed (0 errors).
- `npm run build --prefix client`: Built successfully in 545ms.
- `git diff --check`: 0 whitespace or formatting issues.

---

## 6. Scope Boundaries & Next Phase Readiness

All Phase 2A objectives are fulfilled. The codebase is prepared for **Phase 2B (Design System Component Library & Streaming UX)**:
1. Visual identity is generated first and saved with the project.
2. File planning and component generation follow strict token contracts.
3. Foundation CSS styles precede component code generation.
4. Legacy projects without design specifications continue to operate without regression.

