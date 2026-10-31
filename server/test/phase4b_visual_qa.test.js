import { describe, it } from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import {
  analyzeProjectVisualQuality,
  buildVisualQAFixPrompt,
} from '../services/visualQa.js';
import { getProjectVisualQA } from '../controllers/projectController.js';
import { Project } from '../models/Project.js';

describe('Phase 4B: Automated Visual Quality Assurance Engine Suite', () => {
  describe('Task 1: Horizontal Overflow & Mobile Viewport Clipping', () => {
    it('detects hardcoded fixed pixel widths that break mobile viewports (<768px)', () => {
      const failingFiles = {
        '/components/Hero.jsx': `
          export default function Hero() {
            return (
              <div className="w-[1200px] bg-zinc-900 mx-auto">
                <h1>Welcome</h1>
              </div>
            );
          }
        `,
      };

      const report = analyzeProjectVisualQuality(failingFiles);
      assert.strictEqual(report.status, 'defects_detected');
      assert.strictEqual(report.summary.categories.overflow, 1);
      assert.strictEqual(report.issues[0].category, 'overflow');
      assert.strictEqual(report.issues[0].severity, 'critical');
      assert.ok(report.issues[0].message.includes('horizontal overflow'));
      assert.strictEqual(report.issues[0].line, 4);
    });

    it('detects w-screen inside container elements causing horizontal scrollbars', () => {
      const filesWithScreen = {
        '/components/Navbar.jsx': `
          export default function Navbar() {
            return (
              <nav className="container w-screen overflow-hidden">
                <div>Logo</div>
              </nav>
            );
          }
        `,
      };

      const report = analyzeProjectVisualQuality(filesWithScreen);
      assert.strictEqual(report.summary.categories.overflow, 1);
      assert.strictEqual(report.issues[0].severity, 'warning');
    });

    it('passes responsive fluid widths (w-full max-w-6xl mx-auto px-4)', () => {
      const passingFiles = {
        '/components/Hero.jsx': `
          export default function Hero() {
            return (
              <section className="w-full max-w-6xl mx-auto px-4 py-16">
                <h1 className="text-4xl font-bold">Fluid Hero</h1>
              </section>
            );
          }
        `,
      };

      const report = analyzeProjectVisualQuality(passingFiles);
      assert.strictEqual(report.summary.categories.overflow, 0);
      assert.strictEqual(report.status, 'passed');
    });
  });

  describe('Task 2: Responsive Grid & Vertical Flow Constraints', () => {
    it('detects multi-column grid layouts lacking responsive mobile breakpoints', () => {
      const failingGrid = {
        '/components/Features.jsx': `
          export default function Features() {
            return (
              <div className="grid grid-cols-3 gap-6">
                <div>Card 1</div>
                <div>Card 2</div>
                <div>Card 3</div>
              </div>
            );
          }
        `,
      };

      const report = analyzeProjectVisualQuality(failingGrid);
      assert.strictEqual(report.summary.categories.responsive, 1);
      assert.strictEqual(report.issues[0].category, 'responsive');
      assert.ok(report.issues[0].message.includes('Multi-column grid'));
      assert.ok(report.issues[0].suggestedFix.includes('grid-cols-1 md:grid-cols-3'));
    });

    it('passes responsive grids with mobile-first breakpoints (grid-cols-1 md:grid-cols-3)', () => {
      const responsiveGrid = {
        '/components/Features.jsx': `
          export default function Features() {
            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>Card 1</div>
                <div>Card 2</div>
                <div>Card 3</div>
              </div>
            );
          }
        `,
      };

      const report = analyzeProjectVisualQuality(responsiveGrid);
      assert.strictEqual(report.summary.categories.responsive, 0);
    });

    it('detects excessive fixed pixel heights restricting mobile reflow', () => {
      const fixedHeightFiles = {
        '/components/Hero.jsx': `
          export default function Hero() {
            return (
              <section className="h-[1200px] bg-slate-900">
                <h2>Oversized Section</h2>
              </section>
            );
          }
        `,
      };

      const report = analyzeProjectVisualQuality(fixedHeightFiles);
      assert.strictEqual(report.summary.categories.responsive, 1);
      assert.ok(report.issues[0].suggestedFix.includes('min-h'));
    });
  });

  describe('Task 3: Asset Integrity & Placeholder Validation', () => {
    it('detects generic via.placeholder.com URLs', () => {
      const files = {
        '/components/Gallery.jsx': `
          export default function Gallery() {
            return (
              <div>
                <img src="https://via.placeholder.com/600x400" alt="Placeholder" />
              </div>
            );
          }
        `,
      };

      const report = analyzeProjectVisualQuality(files);
      assert.strictEqual(report.summary.categories.assets, 1);
      assert.strictEqual(report.issues[0].severity, 'warning');
      assert.ok(report.issues[0].message.includes('Generic placeholder'));
    });

    it('detects dead example.com asset URLs as critical severity', () => {
      const files = {
        '/components/Banner.jsx': `
          export default function Banner() {
            return (
              <div>
                <img src="https://example.com/banner.jpg" alt="Banner" />
              </div>
            );
          }
        `,
      };

      const report = analyzeProjectVisualQuality(files);
      assert.strictEqual(report.status, 'defects_detected');
      assert.strictEqual(report.summary.critical, 1);
      assert.strictEqual(report.issues[0].severity, 'critical');
      assert.ok(report.issues[0].message.includes('Dead example.com'));
    });

    it('accepts legitimate high-quality CDN assets and Unsplash URLs', () => {
      const files = {
        '/components/Hero.jsx': `
          export default function Hero() {
            return (
              <div>
                <img src="https://images.unsplash.com/photo-1517245386807-bb43f82c33c4" alt="Modern Workspace" />
              </div>
            );
          }
        `,
      };

      const report = analyzeProjectVisualQuality(files);
      assert.strictEqual(report.summary.categories.assets, 0);
    });
  });

  describe('Task 4: Accessibility & Visual Semantics', () => {
    it('detects <img> tags missing alt attributes', () => {
      const files = {
        '/components/Avatar.jsx': `
          export default function Avatar() {
            return <img src="https://images.unsplash.com/photo-1" className="size-10 rounded-full" />;
          }
        `,
      };

      const report = analyzeProjectVisualQuality(files);
      assert.strictEqual(report.summary.categories.accessibility, 1);
      assert.ok(report.issues[0].message.includes('missing `alt` attribute'));
    });

    it('detects icon-only buttons lacking aria-label or title', () => {
      const files = {
        '/components/Header.jsx': `
          export default function Header() {
            return (
              <header>
                <button className="p-2">
                  <MenuIcon size={20} />
                </button>
              </header>
            );
          }
        `,
      };

      const report = analyzeProjectVisualQuality(files);
      assert.strictEqual(report.summary.categories.accessibility, 1);
      assert.ok(report.issues[0].message.includes('Icon-only `<button>` lacks accessible `aria-label`'));
    });

    it('passes accessible images with alt and icon buttons with aria-label', () => {
      const files = {
        '/components/Header.jsx': `
          export default function Header() {
            return (
              <header>
                <img src="https://images.unsplash.com/photo-1" alt="Company Logo" />
                <button aria-label="Open Navigation Menu" className="p-2">
                  <MenuIcon size={20} />
                </button>
              </header>
            );
          }
        `,
      };

      const report = analyzeProjectVisualQuality(files);
      assert.strictEqual(report.summary.categories.accessibility, 0);
    });
  });

  describe('Task 5: Typography & DesignSpec Archetype Alignment', () => {
    it('flags stylesheet when declared heading font is not imported in styles.css', () => {
      const designSpec = {
        archetype: 'editorial-luxury',
        typography: {
          headingFont: 'Playfair Display',
          bodyFont: 'Plus Jakarta Sans',
        },
      };

      const files = {
        '/styles.css': `@import "tailwindcss";\nbody { font-family: sans-serif; }`,
      };

      const report = analyzeProjectVisualQuality(files, designSpec);
      assert.strictEqual(report.summary.categories.typography, 1);
      assert.ok(report.issues[0].message.includes('Playfair Display'));
    });

    it('passes when declared heading font is included in styles.css', () => {
      const designSpec = {
        archetype: 'editorial-luxury',
        typography: {
          headingFont: 'Playfair Display',
          bodyFont: 'Plus Jakarta Sans',
        },
      };

      const files = {
        '/styles.css': `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900&display=swap');`,
      };

      const report = analyzeProjectVisualQuality(files, designSpec);
      assert.strictEqual(report.summary.categories.typography, 0);
    });

    it('evaluates archetype compliance correctly across distinct archetypes', () => {
      const archetypes = ['editorial-luxury', 'neo-brutalist', 'developer-dark', 'minimal-saas'];

      for (const archetype of archetypes) {
        const spec = { archetype, typography: { headingFont: 'Inter' } };
        const cleanFiles = {
          '/styles.css': `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');`,
          '/App.jsx': `<div className="w-full max-w-4xl mx-auto px-4"><h1 className="text-3xl">Title</h1></div>`,
        };

        const report = analyzeProjectVisualQuality(cleanFiles, spec);
        assert.strictEqual(report.status, 'passed');
        assert.strictEqual(report.archetypeCompliance.archetype, archetype);
        assert.strictEqual(report.archetypeCompliance.compliant, true);
      }
    });
  });

  describe('Task 6: Targeted AI Revision Prompt Generation', () => {
    it('returns null when no issues are identified', () => {
      const cleanReport = {
        issues: [],
      };
      const prompt = buildVisualQAFixPrompt(cleanReport);
      assert.strictEqual(prompt, null);
    });

    it('formats actionable line-by-line fix instructions without breaking DesignSpec', () => {
      const sampleReport = {
        issues: [
          {
            category: 'overflow',
            severity: 'critical',
            file: '/components/Hero.jsx',
            line: 5,
            message: 'Hardcoded large fixed width triggers horizontal overflow on mobile viewports (<768px).',
            suggestedFix: 'Replace fixed width with responsive constraints such as `w-full max-w-5xl mx-auto px-4`.',
          },
          {
            category: 'accessibility',
            severity: 'warning',
            file: '/components/Navbar.jsx',
            line: 12,
            message: 'Icon-only `<button>` lacks accessible `aria-label` or text label.',
            suggestedFix: 'Add `aria-label="Action description"` to icon-only buttons.',
          },
        ],
      };

      const prompt = buildVisualQAFixPrompt(sampleReport);
      assert.ok(prompt.includes('targeted fixes for the following visual QA defects'));
      assert.ok(prompt.includes('/components/Hero.jsx'));
      assert.ok(prompt.includes('line 5'));
      assert.ok(prompt.includes('Replace fixed width with responsive constraints'));
      assert.ok(prompt.includes('/components/Navbar.jsx'));
      assert.ok(prompt.includes('line 12'));
      assert.ok(prompt.includes('without modifying unrelated files or breaking the DesignSpec'));
      assert.ok(prompt.includes('mobile viewports (<768px) and desktop viewports'));
    });
  });

  describe('Task 7: Visual QA Endpoint Security & Authorization', () => {
    it('rejects unauthenticated requests with HTTP 401', async () => {
      let statusCode = null;
      let jsonBody = null;

      const req = { user: null };
      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (body) => {
              jsonBody = body;
            },
          };
        },
      };

      await getProjectVisualQA(req, res);
      assert.strictEqual(statusCode, 401);
      assert.deepStrictEqual(jsonBody, { error: 'Unauthorized' });
    });

    it('rejects invalid ObjectId formats with HTTP 404', async () => {
      let statusCode = null;
      let jsonBody = null;

      const req = {
        user: { userId: '507f1f77bcf86cd799439011' },
        params: { id: 'invalid-id-xyz' },
      };
      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (body) => {
              jsonBody = body;
            },
          };
        },
      };

      await getProjectVisualQA(req, res);
      assert.strictEqual(statusCode, 404);
      assert.deepStrictEqual(jsonBody, { error: 'Project not found' });
    });

    it('rejects cross-user inspection of other users projects with HTTP 403', async () => {
      const ownerId = new mongoose.Types.ObjectId();
      const attackerId = new mongoose.Types.ObjectId();

      const origFindById = Project.findById;
      Project.findById = async () => ({
        _id: new mongoose.Types.ObjectId(),
        owner: ownerId,
        name: 'Private Project',
      });

      try {
        let statusCode = null;
        let jsonBody = null;

        const req = {
          user: { userId: attackerId.toString() },
          params: { id: new mongoose.Types.ObjectId().toString() },
        };
        const res = {
          status: (code) => {
            statusCode = code;
            return {
              json: (body) => {
                jsonBody = body;
              },
            };
          },
        };

        await getProjectVisualQA(req, res);
        assert.strictEqual(statusCode, 403);
        assert.deepStrictEqual(jsonBody, { error: 'Access denied' });
      } finally {
        Project.findById = origFindById;
      }
    });

    it('returns structured QA report and fix prompt for authorized project owner', async () => {
      const ownerId = new mongoose.Types.ObjectId();
      const projectId = new mongoose.Types.ObjectId();

      const origFindById = Project.findById;
      Project.findById = async () => ({
        _id: projectId,
        owner: ownerId,
        name: 'My Store',
        designSpec: {
          archetype: 'minimal-saas',
          typography: { headingFont: 'Inter' },
        },
        files: {
          '/App.jsx': {
            content: `export default function App() { return <div className="w-[1200px]">Test</div>; }`,
          },
        },
      });

      try {
        let jsonBody = null;
        const req = {
          user: { userId: ownerId.toString() },
          params: { id: projectId.toString() },
        };
        const res = {
          json: (body) => {
            jsonBody = body;
          },
        };

        await getProjectVisualQA(req, res);
        assert.ok(jsonBody);
        assert.strictEqual(jsonBody.projectId, projectId);
        assert.strictEqual(jsonBody.projectName, 'My Store');
        assert.strictEqual(jsonBody.qaReport.status, 'defects_detected');
        assert.strictEqual(jsonBody.qaReport.summary.categories.overflow, 1);
        assert.ok(jsonBody.fixPrompt.includes('/App.jsx'));
      } finally {
        Project.findById = origFindById;
      }
    });
  });
});
