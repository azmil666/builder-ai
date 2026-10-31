import 'dotenv/config';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_SYSTEM,
  REVISE_SYSTEM,
  DESIGN_SPEC_SYSTEM,
  createDefaultDesignSpec,
} from '../services/prompts.js';
import { DesignSpecSchema } from '../services/aiSchemas.js';

describe('Phase 2B: Generative Design Quality & Diversity Tests', () => {

  describe('Task 1: System Prompts De-templated & Generic Constraints Removed', () => {
    it('BASE_SYSTEM does not enforce light mode by default', () => {
      assert.doesNotMatch(
        BASE_SYSTEM,
        /ONLY CREATE PROJECTS IN LIGHT MODE BY DEFAULT/i,
        'Should not mandate light mode by default',
      );
    });

    it('BASE_SYSTEM does not mandate hardcoded indigo badge chips or generic gradients', () => {
      assert.doesNotMatch(BASE_SYSTEM, /bg-indigo-50 text-indigo-700/);
      assert.doesNotMatch(BASE_SYSTEM, /from-indigo-600 to-violet-600/);
    });

    it('BASE_SYSTEM does not enforce mandatory 3-tier pricing cards or identical bento sections', () => {
      assert.doesNotMatch(BASE_SYSTEM, /Three tiers, center card highlighted/);
      assert.doesNotMatch(BASE_SYSTEM, /Bento-style grid with mixed card sizes/);
    });

    it('BASE_SYSTEM does not mandate broken Font Awesome CDN icons', () => {
      assert.doesNotMatch(BASE_SYSTEM, /Font Awesome stylesheet is loaded globally/);
      assert.doesNotMatch(BASE_SYSTEM, /<i className='fa-solid/);
      assert.match(BASE_SYSTEM, /lucide-react/, 'Should recommend lucide-react inline SVG icons');
    });

    it('BASE_SYSTEM does not repeat hardcoded static Unsplash photo IDs', () => {
      assert.doesNotMatch(BASE_SYSTEM, /photo-1498050108023-c5249f4df085/);
      assert.doesNotMatch(BASE_SYSTEM, /photo-1534528741775-53994a69daeb/);
      assert.doesNotMatch(BASE_SYSTEM, /photo-1507003211169-0a1dd7228f2d/);
    });

    it('BASE_SYSTEM mandates reduced-motion accessibility support', () => {
      assert.match(BASE_SYSTEM, /prefers-reduced-motion/);
    });
  });

  describe('Task 2 & 3: Archetype Spectrum & Intentional Typography across 8 Categories', () => {
    const testCases = [
      {
        categoryName: 'SaaS landing page',
        prompt: 'Modern high-converting developer analytics SaaS landing page',
        expectedCategory: 'saas_landing',
        expectedArchetypes: ['clean_modern', 'dark_luxury'],
        expectedFontFamily: 'Plus Jakarta Sans',
      },
      {
        categoryName: 'Personal creative portfolio',
        prompt: 'Award-winning creative director portfolio showcasing interactive 3D web experiments',
        expectedCategory: 'agency_portfolio',
        expectedArchetypes: ['experimental_creative'],
        expectedFontFamily: 'Syne',
      },
      {
        categoryName: 'Restaurant website',
        prompt: 'Artisanal farm-to-table bistro and natural wine bar in Brooklyn',
        expectedCategory: 'restaurant_hospitality',
        expectedArchetypes: ['organic_natural', 'editorial_magazine'],
        expectedFontFamily: 'Fraunces',
      },
      {
        categoryName: 'Ecommerce storefront',
        prompt: 'Minimalist Japanese streetwear apparel boutique shop and drop lookbook',
        expectedCategory: 'ecommerce',
        expectedArchetypes: ['modern_ecommerce'],
        expectedFontFamily: 'Plus Jakarta Sans',
      },
      {
        categoryName: 'Architecture studio',
        prompt: 'Contemporary residential architecture studio and monograph atelier',
        expectedCategory: 'agency_portfolio',
        expectedArchetypes: ['editorial_magazine'],
        expectedFontFamily: 'Playfair Display',
      },
      {
        categoryName: 'Editorial publication',
        prompt: 'Literary cultural magazine and investigative longform journalism publication',
        expectedCategory: 'editorial_blog',
        expectedArchetypes: ['editorial_magazine'],
        expectedFontFamily: 'Playfair Display',
      },
      {
        categoryName: 'Technology product',
        prompt: 'Deeptech quantum computing cloud runtime and decentralized robotics infrastructure',
        expectedCategory: 'developer_tools',
        expectedArchetypes: ['futuristic_technology'],
        expectedFontFamily: 'Space Grotesk',
      },
      {
        categoryName: 'Professional services',
        prompt: 'Global corporate management consulting and private equity advisory firm',
        expectedCategory: 'saas_landing',
        expectedArchetypes: ['professional_corporate'],
        expectedFontFamily: 'Plus Jakarta Sans',
      },
    ];

    for (const tc of testCases) {
      it(`evaluates category: ${tc.categoryName}`, () => {
        const spec = createDefaultDesignSpec(tc.prompt);
        const validated = DesignSpecSchema.parse(spec);

        assert.equal(validated.category, tc.expectedCategory, `Category mismatch for ${tc.categoryName}`);
        assert.ok(
          tc.expectedArchetypes.includes(validated.archetype),
          `Archetype ${validated.archetype} not in [${tc.expectedArchetypes.join(', ')}] for ${tc.categoryName}`,
        );
        assert.equal(
          validated.typography.heading.family,
          tc.expectedFontFamily,
          `Heading font mismatch for ${tc.categoryName}`,
        );
        assert.ok(validated.colorPalette.bg, 'Must have background color');
        assert.ok(validated.colorPalette.fg, 'Must have foreground color');
        assert.ok(validated.colorPalette.accent, 'Must have accent color');
        assert.ok(validated.signature.length > 10, 'Must have descriptive signature hook');
      });
    }

    it('demonstrates visual differentiation across categories', () => {
      const restaurant = createDefaultDesignSpec('Natural wine bistro restaurant in Soho');
      const tech = createDefaultDesignSpec('Autonomous robotics deeptech cloud runtime');
      const editorial = createDefaultDesignSpec('Investigative cultural journalism publication magazine');

      // Theme diversity
      assert.notEqual(restaurant.colorPalette.accent, tech.colorPalette.accent, 'Accents must differ');
      assert.notEqual(restaurant.typography.heading.family, tech.typography.heading.family, 'Typography must differ');
      assert.notEqual(tech.colorPalette.bg, editorial.colorPalette.bg, 'Backgrounds must differ');
      assert.notEqual(restaurant.signature, tech.signature, 'Signatures must differ');
    });
  });

  describe('Task 4 & 5: MotionSites Media & Animation Guidance', () => {
    it('BASE_SYSTEM includes MotionSites CloudFront video asset URLs', () => {
      assert.match(BASE_SYSTEM, /cloudfront\.net\/user_38xzZboKViGWJOttwIXH07lWA1P/);
    });

    it('DESIGN_SPEC_SYSTEM describes all 12 design archetypes', () => {
      const archetypes = [
        'clean_modern',
        'dark_luxury',
        'editorial_magazine',
        'swiss_international',
        'neo_brutalism',
        'experimental_creative',
        'futuristic_technology',
        'organic_natural',
        'modern_ecommerce',
        'professional_corporate',
        'bento_grid',
        'minimal_utility',
      ];

      for (const arch of archetypes) {
        assert.match(DESIGN_SPEC_SYSTEM, new RegExp(arch), `Missing archetype description for ${arch}`);
      }
    });
  });

  describe('Task 6: Design Consistency in Revisions', () => {
    it('REVISE_SYSTEM instructs preserving the existing DesignSpec', () => {
      assert.match(
        REVISE_SYSTEM,
        /PRESERVE DESIGN CONSISTENCY|preserve the existing visual design/i,
        'Revision prompt must enforce design consistency',
      );
    });
  });
});

