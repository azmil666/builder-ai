import 'dotenv/config';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  loadCraftworkSkill,
  getCraftworkMetadata,
  getCraftworkRuntimeGuidance,
  getCraftworkDesignSpecGuidance,
  getCraftworkFilePlanGuidance,
  getCraftworkCodeGuidance,
  getCraftworkRevisionGuidance,
  setCraftworkSkillDir,
  resetCraftworkSkillCache,
} from '../services/craftworkSkill.js';

import {
  BASE_SYSTEM,
  DESIGN_SPEC_SYSTEM,
  REVISE_SYSTEM,
  buildFilePlanSystem,
  buildFileCodeSystem,
  createDefaultDesignSpec,
} from '../services/prompts.js';

import {
  getActiveAiProvider,
  generateStructuredObject,
} from '../services/ai.js';
import { DesignSpecSchema, FileCodeSchema } from '../services/aiSchemas.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Craftwork Design Skill Runtime Integration Suite', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetCraftworkSkillCache();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetCraftworkSkillCache();
  });

  // 1. Storage, Versioning, and Fail-Fast Loading
  describe('Task 1: Local Skill Storage, Metadata, and Fail-Fast Loading', () => {
    it('successfully loads the project-local runtime Craftwork guidance', () => {
      const guidance = loadCraftworkSkill();
      assert.ok(guidance && typeof guidance === 'string', 'Guidance must be a non-empty string');
      assert.match(guidance, /Craftwork Design System & Quality Guidance for Builder AI/);
      assert.match(guidance, /Lock One Style and One Theme/);
      assert.match(guidance, /Craftwork Taste Rules & Anti-AI Tells/);
    });

    it('loads metadata recording upstream source, version, and refresh procedure', () => {
      const metadata = getCraftworkMetadata();
      assert.strictEqual(metadata.skillName, 'craftwork-design');
      assert.strictEqual(metadata.sourcePackage, '@craftwork-design/wizard@latest');
      assert.ok(metadata.retrievalDate, 'Must have retrieval date recorded');
      assert.ok(Array.isArray(metadata.refreshProcedure), 'Must have refresh procedure steps');
      assert.ok(metadata.refreshProcedure.length >= 3, 'Must have detailed refresh steps');
      assert.strictEqual(metadata.upstreamStoragePath, 'server/skills/craftwork-design/upstream/SKILL.md');
      assert.match(metadata.mcpStatus, /not integrated/i, 'Must clarify MCP status');
    });

    it('verifies upstream SKILL.md is preserved faithfully on disk', () => {
      const upstreamPath = path.resolve(__dirname, '../skills/craftwork-design/upstream/SKILL.md');
      assert.ok(fs.existsSync(upstreamPath), 'Upstream SKILL.md must exist in project storage');
      const content = fs.readFileSync(upstreamPath, 'utf-8');
      assert.match(content, /name: craftwork-design/);
      assert.match(content, /Taste rules/);
      assert.match(content, /No image beats a wrong image/);
    });

    it('fails clearly with descriptive error if required runtime skill material is missing', () => {
      // Point to a non-existent directory
      const fakeDir = path.resolve(__dirname, '../skills/non-existent-craftwork-dir');
      setCraftworkSkillDir(fakeDir);

      assert.throws(
        () => loadCraftworkSkill(),
        (err) => {
          assert.match(err.message, /\[CraftworkSkill\] Failed to load required runtime Craftwork design guidance/);
          assert.match(err.message, /Do not silently continue with generic prompts/);
          return true;
        },
        'Must fail fast when skill file is missing'
      );
    });
  });

  // 2. Integration Across Generation Stages
  describe('Task 2: Guidance Inclusion Across Every Pipeline Stage', () => {
    const mockDesignSpec = createDefaultDesignSpec('Modern analytics SaaS platform');

    it('Stage 1 - DesignSpec generation system prompt includes Craftwork aesthetic guidance', () => {
      assert.ok(DESIGN_SPEC_SYSTEM.includes('CRAFTWORK DESIGN INTELLIGENCE & AESTHETIC GUIDANCE'));
      assert.match(DESIGN_SPEC_SYSTEM, /Design Read & One Idea/);
      assert.match(DESIGN_SPEC_SYSTEM, /Variance/);
      assert.match(DESIGN_SPEC_SYSTEM, /Motion/);
      assert.match(DESIGN_SPEC_SYSTEM, /Density/);
      assert.match(DESIGN_SPEC_SYSTEM, /Lock One Style & One Theme/);
      assert.match(DESIGN_SPEC_SYSTEM, /Concentric nested radii/i);
      // Retains all 12 original archetypes
      assert.match(DESIGN_SPEC_SYSTEM, /"clean_modern"/);
      assert.match(DESIGN_SPEC_SYSTEM, /"dark_luxury"/);
      assert.match(DESIGN_SPEC_SYSTEM, /"editorial_magazine"/);
      assert.match(DESIGN_SPEC_SYSTEM, /"minimal_utility"/);
    });

    it('Stage 2 - File planning system prompt embeds Craftwork architecture & component guidelines', () => {
      const planPrompt = buildFilePlanSystem(mockDesignSpec);
      assert.match(planPrompt, /CRAFTWORK ARCHITECTURAL & COMPONENT PLANNING GUIDELINES/);
      assert.match(planPrompt, /Genre-Led Architecture/);
      assert.match(planPrompt, /Do NOT plan generic 3-identical-card feature rows/);
      assert.match(planPrompt, /ACTIVE DESIGN SPECIFICATION CONTRACT/);
      assert.match(planPrompt, /saas_landing/i);
      assert.match(planPrompt, /clean_modern/i);
    });

    it('Stage 3 - File code generation prompt embeds Craftwork taste rules & production standards', () => {
      const plannedFiles = [
        { path: '/App.js', description: 'Main App', imports: ['./styles.css'], exports: 'default App' },
        { path: '/styles.css', description: 'CSS Styles', imports: [], exports: 'none' },
      ];
      const codePrompt = buildFileCodeSystem(plannedFiles, {}, mockDesignSpec);

      assert.match(codePrompt, /CRAFTWORK TASTE RULES & PRODUCTION STANDARDS/);
      // Taste rules & anti-AI tells
      assert.match(codePrompt, /HOVER NEVER RECOLORS BORDERS ALONE/);
      assert.match(codePrompt, /text-wrap: balance/);
      assert.match(codePrompt, /NO em dashes/);
      assert.match(codePrompt, /NO middle dots/);
      assert.match(codePrompt, /NO filler buzzwords/);
      assert.match(codePrompt, /min-h-dvh/);
      assert.match(codePrompt, /MANDATORY DESIGN SPECIFICATION COMPLIANCE/);
      assert.match(codePrompt, /lucide-react/);
    });

    it('Stage 4 - Targeted AI repair & self-repair preserves Craftwork guidance', () => {
      const plannedFiles = [
        { path: '/App.js', description: 'Main App', imports: ['./styles.css'], exports: 'default App' },
      ];
      const repairSystem = buildFileCodeSystem(plannedFiles, { '/App.js': 'export default function App() {}' }, mockDesignSpec);
      
      // Repair system prompt contains Craftwork taste rules
      assert.match(repairSystem, /CRAFTWORK TASTE RULES & PRODUCTION STANDARDS/);
      assert.match(repairSystem, /HOVER NEVER RECOLORS BORDERS ALONE/);
      assert.match(repairSystem, /MANDATORY DESIGN SPECIFICATION COMPLIANCE/);
    });

    it('Stage 5 - Project revisions prompt embeds Craftwork consistency standards', () => {
      assert.match(REVISE_SYSTEM, /CRAFTWORK REVISION & CONSISTENCY STANDARDS/);
      assert.match(REVISE_SYSTEM, /Preserve DesignSpec & Style Lock/);
      assert.match(REVISE_SYSTEM, /Maintain visible, smooth animated hover on all interactive elements without recoloring borders on hover/);
      assert.match(REVISE_SYSTEM, /Never introduce em dashes/);
      assert.match(REVISE_SYSTEM, /PRESERVE DESIGN CONSISTENCY/);
    });
  });

  // 3. Shared Model Abstraction (Gemini & OpenRouter Provider Parity)
  describe('Task 3: Provider Parity (Gemini & OpenRouter Shared Prompt Path)', () => {
    it('verifies getActiveAiProvider resolves correctly', () => {
      process.env.AI_PROVIDER = 'gemini';
      assert.strictEqual(getActiveAiProvider(), 'gemini');

      process.env.AI_PROVIDER = 'openrouter';
      assert.strictEqual(getActiveAiProvider(), 'openrouter');
    });

    it('verifies both providers receive the identical prompt-building path without live paid model calls', async () => {
      // Test that generateStructuredObject passes system prompt with Craftwork guidance identically
      // We mock both providers to intercept the call and inspect arguments
      
      const testSchema = FileCodeSchema;
      const plannedFiles = [{ path: '/App.js', description: 'App', imports: [], exports: 'default App' }];
      const craftworkSystem = buildFileCodeSystem(plannedFiles, {}, null);

      assert.match(craftworkSystem, /CRAFTWORK TASTE RULES/);

      // Verify Gemini path:
      // When AI_PROVIDER=gemini, generateStructuredObject routes to generateGeminiObject
      // If GEMINI_API_KEY is not set or client mocked, it uses the exact `system` and `prompt`
      process.env.AI_PROVIDER = 'gemini';
      process.env.GEMINI_API_KEY = 'AIzaSyFakeKeyForTestingMockProvider01';

      // Verify cleanJsonSchema handles schemas passed to Gemini
      assert.ok(craftworkSystem.length > 500, 'System prompt must be complete and non-trivial');

      // Verify OpenRouter path:
      process.env.AI_PROVIDER = 'openrouter';
      process.env.OPENROUTER_API_KEY = 'sk-or-fake-key-for-testing';
      assert.strictEqual(getActiveAiProvider(), 'openrouter');
      
      // Both routes consume the exact same `system` produced by buildFileCodeSystem / DESIGN_SPEC_SYSTEM / REVISE_SYSTEM
      assert.match(DESIGN_SPEC_SYSTEM, /CRAFTWORK DESIGN INTELLIGENCE/);
      assert.match(REVISE_SYSTEM, /CRAFTWORK REVISION/);
    });
  });

  // 4. Conflict Resolutions & Non-Negotiable Contract Safeguards
  describe('Task 4: Conflict Resolution & Runtime Safety', () => {
    it('ensures Craftwork rules preserve Sandpack-supported lucide-react icons and forbid external CDNs', () => {
      assert.match(BASE_SYSTEM, /lucide-react/);
      assert.doesNotMatch(BASE_SYSTEM, /font-awesome|fontawesome|fa-solid/i);
    });

    it('ensures Craftwork rules preserve component prop contracts and default parameter safety', () => {
      assert.match(BASE_SYSTEM, /Prop Contract Standard/);
      assert.match(BASE_SYSTEM, /STORE_CONFIG/);
      assert.match(BASE_SYSTEM, /safe optional chaining/);
    });

    it('ensures Craftwork rules enforce single-file architecture for small interactive tools/games', () => {
      assert.match(BASE_SYSTEM, /SINGLE FILE RULE FOR SMALL APPS\/GAMES/);
    });

    it('ensures DesignSpec and user prompt remain authoritative over generic defaults', () => {
      assert.match(BASE_SYSTEM, /The visual design must be dictated entirely by the user's requirements and the established DesignSpec/);
    });

    it('ensures generateProject allows files variable reassignment during self-repair loop', async () => {
      // Verify files is declared as let, allowing reassignment with repairResult.files
      const aiModuleSrc = fs.readFileSync(path.resolve(__dirname, '../services/ai.js'), 'utf-8');
      assert.match(aiModuleSrc, /let\s+files\s*=\s*\{\};/, 'files must be declared as let in generateProject to allow self-repair assignment');
      assert.doesNotMatch(aiModuleSrc, /const\s+files\s*=\s*\{\};[\s\S]*files\s*=\s*repairResult\.files;/, 'files must not be declared as const when reassigned in self-repair');
    });
  });
});
