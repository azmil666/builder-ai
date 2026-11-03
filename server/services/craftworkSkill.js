import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base directory for project-local Craftwork skill
const DEFAULT_SKILL_DIR = path.resolve(__dirname, "../skills/craftwork-design");
const RUNTIME_GUIDANCE_FILE = "runtime-guidance.md";
const METADATA_FILE = "metadata.json";

let _cachedGuidance = null;
let _cachedMetadata = null;
let _customSkillDir = null;

/**
 * Configure a custom skill directory (primarily for testing failure conditions).
 */
export function setCraftworkSkillDir(dir) {
  _customSkillDir = dir;
  _cachedGuidance = null;
  _cachedMetadata = null;
}

/**
 * Resets the in-memory cache of Craftwork guidance.
 */
export function resetCraftworkSkillCache() {
  _cachedGuidance = null;
  _cachedMetadata = null;
  _customSkillDir = null;
}

/**
 * Explicitly loads the runtime Craftwork skill guidance from the project-local file.
 * Throws a descriptive error if the file is missing or unreadable.
 */
export function loadCraftworkSkill() {
  if (_cachedGuidance) {
    return _cachedGuidance;
  }

  const baseDir = _customSkillDir || DEFAULT_SKILL_DIR;
  const filePath = path.join(baseDir, RUNTIME_GUIDANCE_FILE);

  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Skill file does not exist at path: ${filePath}`);
    }
    const content = fs.readFileSync(filePath, "utf-8");
    if (!content || content.trim().length === 0) {
      throw new Error(`Skill file at ${filePath} is empty.`);
    }
    _cachedGuidance = content.trim();
    return _cachedGuidance;
  } catch (err) {
    throw new Error(
      `[CraftworkSkill] Failed to load required runtime Craftwork design guidance: ${err.message}. ` +
      `Ensure '${filePath}' is present and readable. Do not silently continue with generic prompts.`
    );
  }
}

/**
 * Loads metadata describing the upstream Craftwork skill, version, and refresh procedure.
 */
export function getCraftworkMetadata() {
  if (_cachedMetadata) {
    return _cachedMetadata;
  }

  const baseDir = _customSkillDir || DEFAULT_SKILL_DIR;
  const metaPath = path.join(baseDir, METADATA_FILE);

  try {
    if (!fs.existsSync(metaPath)) {
      throw new Error(`Metadata file does not exist at path: ${metaPath}`);
    }
    const raw = fs.readFileSync(metaPath, "utf-8");
    _cachedMetadata = JSON.parse(raw);
    return _cachedMetadata;
  } catch (err) {
    throw new Error(
      `[CraftworkSkill] Failed to load Craftwork metadata from '${metaPath}': ${err.message}`
    );
  }
}

/**
 * Returns the raw, complete runtime guidance text.
 */
export function getCraftworkRuntimeGuidance() {
  return loadCraftworkSkill();
}

/**
 * Returns Craftwork guidance tailored specifically for the DesignSpec creation phase.
 */
export function getCraftworkDesignSpecGuidance() {
  loadCraftworkSkill(); // Enforce fail-fast check
  return `
---

## CRAFTWORK DESIGN INTELLIGENCE & AESTHETIC GUIDANCE (Mandatory)

Apply Craftwork's design principles when creating this DesignSpec:
1. **Design Read & One Idea**:
   - Establish an explicit design read: \`<page kind> for <audience>, in a <style family> language, with <key visual device>\`.
   - Name the page's **one idea motif** from the product's domain (e.g. tracking telemetry for logistics, audio waveform frequencies for music tools) that layout and UI repeat.
2. **Three Core Dials (1-10)**:
   - **Variance**: 1 = strict symmetry; 4 = SaaS landing; 8 = agency/portfolio; 9 = event/drop. Use split or asymmetric hero layouts above variance 6.
   - **Motion**: 1 = static; 3 = micro-interactions; 5 = scroll reveals; 7+ = ambient atmospheric effects.
   - **Density**: 1 = spacious gallery; 4 = standard SaaS; 8 = data cockpit/dashboard.
3. **Lock One Style & One Theme**:
   - Adhere strictly to one surface family (do NOT mix light cards on a nocturnal dark canvas or vice versa).
   - Derivation of accent: Accent color MUST come from the product's domain or brand, taking up ~10% of the visual space for primary CTAs and active states.
   - Anti-AI Tell: Never default blindly to generic purple/blue glow gradients or oversaturated neon accents.
4. **Typographic Contrast**:
   - Pair an expressive display family with a highly legible text face.
   - Design for tight heading tracking (-0.02em to -0.03em) and generous line height for body (1.5).
5. **Component Styling & Geometry**:
   - Enforce concentric nested radii (\`outer_radius = inner_radius + padding\`).
   - Use tinted shadows rather than pitch-black drop shadows.
6. **Hero Composition**:
   - Maximum 4 text elements in the first viewport.
   - Feature a real visual centerpiece (interactive component, product preview, or bold typography).
`;
}

/**
 * Returns Craftwork guidance tailored for technical file planning.
 */
export function getCraftworkFilePlanGuidance() {
  loadCraftworkSkill(); // Enforce fail-fast check
  return `
---

## CRAFTWORK ARCHITECTURAL & COMPONENT PLANNING GUIDELINES
When planning project files:
1. **Genre-Led Architecture**:
   - For interactive utilities, calculators, and games: plan ONLY \`/App.js\` and \`/styles.css\`! Keep all logic and UI in \`/App.js\`.
   - For marketing, brand, and commerce websites: plan \`/App.js\`, \`/styles.css\`, and modular, reusable section components in \`/components/\`.
2. **Component Restraint**:
   - Do NOT plan generic 3-identical-card feature rows. Plan varied bento layouts, split story sections, or narrative feature showcases.
   - Plan \`/styles.css\` to carry DesignSpec tokens, Google Fonts import, keyframe animations, and \`prefers-reduced-motion\` handling.
3. **Single Default Export**:
   - Every JS component must declare exactly one default export matching the plan.
`;
}

/**
 * Returns Craftwork guidance tailored for CSS foundation and component code generation.
 */
export function getCraftworkCodeGuidance() {
  loadCraftworkSkill(); // Enforce fail-fast check
  return `
---

## CRAFTWORK TASTE RULES & PRODUCTION STANDARDS (Mandatory for /styles.css and all Components)

Every file you generate MUST satisfy Craftwork's taste rules:
1. **Interactive Hover Micro-Interactions**:
   - EVERY interactive element (navigation links, buttons, cards, list items) MUST have a smooth, visible animated hover (\`transition-all duration-200 ease-out\`).
   - HOVER NEVER RECOLORS BORDERS ALONE! Change the background fill, text color, subtle lift (\`hover:-translate-y-0.5 hover:shadow-md\`), or shadow instead.
2. **Button Scale & Side-by-Side Alignment**:
   - Establish uniform button heights (e.g. \`h-10\` / \`h-11\`). Side-by-side buttons MUST share identical height.
   - Always use action-oriented button copy: verb + object ("Create workspace", "Reserve table"), never bare "Submit" or "Click Here".
   - Only ONE primary filled CTA button per viewport.
3. **Typographic Polish & Widow Prevention**:
   - Apply \`text-wrap: balance\` (or \`[text-wrap:balance]\`) on all headlines and section titles so no single word dangles alone on the last line.
   - Apply \`text-wrap: pretty\` on short descriptions and callouts.
   - Large headings: tight tracking (\`tracking-tight\`), line-height 1.1-1.25, maximum 2 lines on desktop.
4. **Copy & Anti-AI Tells**:
   - NO em dashes (—) or en dashes (–) anywhere in UI text! Use periods, commas, colons, or hyphens.
   - NO middle dots (·) as metadata separators. Use spacing or subtle dividers.
   - NO filler buzzwords ("elevate", "seamless", "unleash", "next-gen", "revolutionize"). State clearly what the product does.
   - Authentic, believable names, numbers, and data.
5. **Surface & Depth**:
   - Concentric nested corners: \`outer_radius = inner_radius + padding\`.
   - Full-height heroes must use \`min-h-dvh\` or \`min-height: 100dvh\` (never \`100vh\`).
   - Screenshots and app windows sit on flat token surfaces. NO random gradient blobs, neon outer glows, or fake metallic frames behind them.
   - NO cards inside cards, NO rounded icon tiles above every heading, NO emoji as icons.
6. **Icons & Styling**:
   - Use \`lucide-react\` inline SVG icons consistently.
   - Preserve all prop contracts and safe default fallbacks (\`config = STORE_CONFIG\`).
`;
}

/**
 * Returns Craftwork guidance tailored for revisions and targeted self-repairs.
 */
export function getCraftworkRevisionGuidance() {
  loadCraftworkSkill(); // Enforce fail-fast check
  return `
---

## CRAFTWORK REVISION & CONSISTENCY STANDARDS
When revising existing files or repairing code:
1. **Preserve DesignSpec & Style Lock**:
   - Retain the established palette tokens, typography pairing, archetype, and radius system unless the user explicitly requests a redesign.
2. **Maintain Craftwork Taste Rules**:
   - Maintain visible, smooth animated hover on all interactive elements without recoloring borders on hover.
   - Maintain concentric border radii and uniform button heights.
   - Never introduce em dashes (—), middle dots (·), or filler buzzwords.
   - Keep headlines wrapped cleanly (\`text-wrap: balance\`) without trailing single-word widows.
   - Preserve component prop contracts and default parameter fallbacks.
`;
}

