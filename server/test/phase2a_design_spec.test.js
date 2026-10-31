import 'dotenv/config';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DesignSpecSchema,
  ColorPaletteSchema,
  TypographyPairingSchema,
  GenerationResultSchema,
  FilePlanSchema,
} from '../services/aiSchemas.js';
import {
  createDefaultDesignSpec,
  buildFilePlanSystem,
  buildFileCodeSystem,
  DESIGN_SPEC_SYSTEM,
} from '../services/prompts.js';
import { Project } from '../models/Project.js';

describe('Phase 2A: Design Intelligence Engine Tests', () => {

  describe('Task 1: DesignSpec Schema Validation', () => {
    const validSpec = {
      purpose: 'Portfolio showcase for an architectural studio',
      targetAudience: 'High-end residential and commercial clients',
      category: 'agency_portfolio',
      visualDirection: 'Minimalist editorial aesthetic with generous whitespace and high-contrast typography',
      archetype: 'editorial_magazine',
      brandPersonality: ['sophisticated', 'meticulous', 'timeless'],
      colorPalette: {
        theme: 'light',
        bg: '#fafaf9',
        fg: '#111827',
        muted: '#6b7280',
        line: '#e5e7eb',
        accent: '#b45309',
        accentForeground: '#ffffff',
        cardBg: '#ffffff',
        cardBorder: '#e5e7eb',
      },
      typography: {
        heading: {
          family: 'Playfair Display',
          weights: ['600', '700'],
          googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&display=swap',
          usage: 'Monograph titles and editorial headers',
        },
        body: {
          family: 'Inter',
          weights: ['400', '500'],
          googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap',
          usage: 'Body copy and captions',
        },
        fontImportUrl: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500&display=swap',
      },
      layout: {
        containerWidth: 'max-w-7xl',
        sectionPadding: 'py-24 md:py-36',
        gap: 'gap-8 md:gap-12',
        structure: 'Narrative editorial monograph with full-bleed image galleries',
      },
      componentStyling: {
        cardRadius: 'rounded-none',
        buttonRadius: 'rounded-none',
        shadow: 'none',
        borderStyle: 'border border-stone-200',
        cardStyle: 'border border-stone-200 bg-white p-8',
      },
      navigation: {
        type: 'minimal_bar',
        details: 'Minimal top bar with architectural monograph branding and contact anchor',
      },
      hero: {
        composition: 'split',
        headline: 'Sculpting spaces that endure.',
        subheadline: 'Contemporary architectural design rooted in context and materiality.',
        ctaText: 'View Monograph',
        details: 'Asymmetric split hero with bold typography and full-height photography',
      },
      mediaDirection: {
        type: 'curated_photography',
        description: 'Monochrome and high-contrast architectural photography',
        imageTreatment: 'Sharp borders, grayscale with subtle hover warmth',
        iconStyle: 'lucide-react inline SVG icons',
      },
      motion: {
        strategy: 'Staggered subtle fades with smooth easing',
        keyframes: ['fadeIn', 'fadeInUp'],
        reducedMotion: true,
      },
      responsive: {
        breakpoints: 'Mobile (<640px), Desktop (>640px)',
        mobileStrategy: 'Single column vertical flow with full-width images',
      },
      accessibility: {
        contrastRatio: 'WCAG 2.2 AA compliant (min 7:1 for text)',
        focusRings: 'focus-visible:ring-2 focus-visible:ring-stone-900',
        semanticElements: true,
      },
      signature: 'Editorial typography with full-bleed gallery reveal transitions',
    };

    it('successfully parses a comprehensive DesignSpec', () => {
      const parsed = DesignSpecSchema.parse(validSpec);
      assert.equal(parsed.archetype, 'editorial_magazine');
      assert.equal(parsed.category, 'agency_portfolio');
      assert.equal(parsed.colorPalette.theme, 'light');
      assert.equal(parsed.typography.heading.family, 'Playfair Display');
      assert.equal(parsed.componentStyling.cardRadius, 'rounded-none');
      assert.equal(parsed.signature, 'Editorial typography with full-bleed gallery reveal transitions');
    });

    it('rejects an invalid archetype enum value', () => {
      const invalidSpec = { ...validSpec, archetype: 'non-existent-archetype' };
      assert.throws(() => DesignSpecSchema.parse(invalidSpec), /archetype/);
    });

    it('rejects an invalid colorPalette theme', () => {
      const invalidSpec = {
        ...validSpec,
        colorPalette: { ...validSpec.colorPalette, theme: 'neon' },
      };
      assert.throws(() => DesignSpecSchema.parse(invalidSpec), /theme/);
    });

    it('applies default values for optional nested structures when omitted', () => {
      const minimalSpec = {
        purpose: 'Simple task manager',
        category: 'saas_landing',
        visualDirection: 'Clean utilitarian interface',
        archetype: 'clean_modern',
        brandPersonality: ['efficient', 'accessible'],
      };

      const parsed = DesignSpecSchema.parse(minimalSpec);
      assert.equal(parsed.archetype, 'clean_modern');
      assert.equal(parsed.colorPalette.theme, 'light', 'Default theme should be light');
      assert.equal(parsed.layout.containerWidth, 'max-w-7xl');
      assert.equal(parsed.navigation.type, 'sticky_header');
      assert.equal(parsed.accessibility.semanticElements, true);
    });
  });

  describe('Task 2: Default DesignSpec Fallback & AI Planning Integration', () => {
    it('generates a valid, schema-compliant fallback DesignSpec for game/interactive prompt', () => {
      const fallback = createDefaultDesignSpec('Retro 80s arcade snake game with neon score board');
      const validated = DesignSpecSchema.parse(fallback);

      assert.equal(validated.category, 'interactive_app');
      assert.equal(validated.archetype, 'minimal_utility');
      assert.equal(validated.colorPalette.theme, 'dark');
      assert.equal(validated.hero.composition, 'interactive_canvas');
      assert.ok(validated.signature.length > 0);
    });

    it('generates a valid, schema-compliant fallback DesignSpec for SaaS/fintech prompt', () => {
      const fallback = createDefaultDesignSpec('AI-powered financial analytics dashboard with revenue charts');
      const validated = DesignSpecSchema.parse(fallback);

      assert.equal(validated.category, 'saas_landing');
      assert.ok(['clean_modern', 'dark_luxury'].includes(validated.archetype));
      assert.ok(validated.colorPalette.accent);
      assert.ok(validated.typography.heading.family);
      assert.ok(validated.typography.body.family);
    });

    it('buildFilePlanSystem embeds DesignSpec rules, tokens and fonts into planner prompt', () => {
      const spec = createDefaultDesignSpec('Luxury artisanal coffee shop landing page');
      const systemPrompt = buildFilePlanSystem(spec);

      assert.match(systemPrompt, /ACTIVE DESIGN SPECIFICATION CONTRACT/);
      assert.match(systemPrompt, new RegExp(spec.archetype));
      assert.match(systemPrompt, new RegExp(spec.colorPalette.accent));
      assert.match(systemPrompt, /Google Fonts/);
      assert.match(systemPrompt, /Rules:/);
    });

    it('buildFilePlanSystem gracefully handles null designSpec', () => {
      const systemPrompt = buildFilePlanSystem(null);
      assert.match(systemPrompt, /You are planning which files to create/);
      assert.doesNotMatch(systemPrompt, /ACTIVE DESIGN SPECIFICATION CONTRACT/);
    });
  });

  describe('Task 3: Code Generation Prompt with DesignSpec & Shared Contracts', () => {
    it('buildFileCodeSystem injects Google Fonts, token directives and Lucide guidelines', () => {
      const spec = createDefaultDesignSpec('Modern fitness gym tracker');
      const plannedFiles = [
        { path: '/App.js', description: 'Root application' },
        { path: '/styles.css', description: 'CSS styles' },
        { path: '/components/Header.js', description: 'Header navigation' },
      ];
      const generatedFiles = {
        '/styles.css': ':root { --color-primary: #10b981; }',
      };

      const systemPrompt = buildFileCodeSystem(plannedFiles, generatedFiles, spec);

      assert.match(systemPrompt, /MANDATORY DESIGN SPECIFICATION COMPLIANCE/);
      assert.match(systemPrompt, new RegExp(spec.archetype));
      assert.match(systemPrompt, new RegExp(spec.colorPalette.accent));
      assert.match(systemPrompt, /lucide-react/);
      assert.match(systemPrompt, /Already Generated Files/);
      assert.match(systemPrompt, /align your exports, imports, CSS selectors, or props signatures/);
    });

    it('buildFileCodeSystem handles null designSpec without error', () => {
      const plannedFiles = [{ path: '/App.js', description: 'Root' }];
      const systemPrompt = buildFileCodeSystem(plannedFiles, {}, null);

      assert.match(systemPrompt, /You are writing a SINGLE file for a React project/);
      assert.doesNotMatch(systemPrompt, /MANDATORY DESIGN SPECIFICATION COMPLIANCE/);
    });
  });

  describe('Task 4: File Plan and GenerationResult Schema Backward Compatibility', () => {
    it('validates FilePlanSchema with import/export contracts', () => {
      const plan = {
        projectName: 'Neon Arcade',
        projectDescription: 'Fast-paced arcade game',
        files: [
          {
            path: '/App.js',
            description: 'Main game shell',
            exports: 'default App',
            imports: ['./styles.css', './components/GameBoard'],
          },
          {
            path: '/styles.css',
            description: 'Retro game styles',
            exports: 'none',
            imports: [],
          },
        ],
      };

      const parsed = FilePlanSchema.parse(plan);
      assert.equal(parsed.files.length, 2);
      assert.equal(parsed.files[0].exports, 'default App');
    });

    it('validates GenerationResultSchema with designSpec present', () => {
      const spec = createDefaultDesignSpec('Creative Agency');
      const result = {
        files: {
          '/App.js': 'export default function App() { return <h1>Hello</h1>; }',
          '/styles.css': 'body { margin: 0; }',
        },
        description: 'Agency portfolio site',
        designSpec: spec,
      };

      const parsed = GenerationResultSchema.parse(result);
      assert.ok(parsed.designSpec);
      assert.equal(parsed.designSpec.archetype, spec.archetype);
    });

    it('validates GenerationResultSchema without designSpec (legacy compatibility)', () => {
      const legacyResult = {
        files: {
          '/App.js': 'export default function App() { return <h1>Legacy</h1>; }',
        },
        description: 'Legacy generated site',
      };

      const parsed = GenerationResultSchema.parse(legacyResult);
      assert.equal(parsed.designSpec, undefined);
      assert.equal(parsed.description, 'Legacy generated site');
    });
  });

  describe('Task 5: Mongoose Model Persistence & Backward Compatibility', () => {
    it('Project model stores designSpec and defaults to null on legacy documents', () => {
      const legacyDoc = new Project({
        name: 'Legacy Project',
        owner: '507f1f77bcf86cd799439011',
        files: {
          '/App.js': { content: 'export default () => <div>Legacy</div>', hash: '123' },
        },
      });

      assert.equal(legacyDoc.designSpec, null, 'Legacy project without designSpec should have null designSpec');
    });

    it('Project model persists complete DesignSpec when provided', () => {
      const spec = createDefaultDesignSpec('Modern SaaS Workflow Platform');
      const newDoc = new Project({
        name: 'SaaS Platform',
        owner: '507f1f77bcf86cd799439011',
        designSpec: spec,
      });

      assert.ok(newDoc.designSpec);
      assert.equal(newDoc.designSpec.archetype, spec.archetype);
      assert.equal(newDoc.designSpec.colorPalette.accent, spec.colorPalette.accent);
      assert.equal(newDoc.designSpec.typography.heading.family, spec.typography.heading.family);
    });

    it('supports updating designSpec on an existing document', () => {
      const doc = new Project({
        name: 'Draft Project',
        owner: '507f1f77bcf86cd799439011',
      });

      assert.equal(doc.designSpec, null);

      const spec = createDefaultDesignSpec('Updated Portfolio');
      doc.designSpec = spec;
      assert.equal(doc.designSpec.archetype, spec.archetype);
    });
  });
});
