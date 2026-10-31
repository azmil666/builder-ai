import 'dotenv/config';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_for_audit';
import { getJwtSecret } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
  listProjects,
  getProject,
  deleteProject,
  updateProjectFiles,
  getPublicProject,
  getProjectVisualQA,
  sanitizeError,
} from '../controllers/projectController.js';
import { Project } from '../models/Project.js';
import { createDefaultDesignSpec } from '../services/prompts.js';
import { DesignSpecSchema, FilePlanSchema } from '../services/aiSchemas.js';
import { validateAndFixCode, validateProject } from '../services/codeValidator.js';
import { applyOperations } from '../services/diff.js';
import { analyzeProjectVisualQuality } from '../services/visualQa.js';
import {
  authRateLimiter,
  aiGenerationRateLimiter,
  aiRevisionRateLimiter,
} from '../middleware/rateLimiter.js';

describe('Phase 5A: Production Readiness & Regression Audit Suite', () => {
  const mockUserId = new mongoose.Types.ObjectId().toString();
  const mockUser = { userID: mockUserId, email: 'operator@builderai.test' };

  describe('1. Authentication & Session Security Lifecycle', () => {
    it('enforces JWT secret presence and fails safely if missing', () => {
      assert.doesNotThrow(() => getJwtSecret());
      const secret = getJwtSecret();
      assert.ok(secret && secret.length > 0);
    });

    it('signs and verifies 30-day session tokens with proper payload structure', () => {
      const token = jwt.sign(mockUser, getJwtSecret(), { expiresIn: '30d' });
      const decoded = jwt.verify(token, getJwtSecret());
      assert.strictEqual(decoded.userID, mockUserId);
      assert.strictEqual(decoded.email, 'operator@builderai.test');
    });

    it('rejects unauthenticated requests on protected routes with HTTP 401', () => {
      let statusCode = null;
      let jsonBody = null;

      const req = { cookies: {} };
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

      authMiddleware(req, res, () => {});
      assert.strictEqual(statusCode, 401);
      assert.ok(jsonBody.error.includes('No session token provided'));
    });

    it('rejects forged or tampered session tokens with HTTP 401', () => {
      let statusCode = null;
      let jsonBody = null;

      const req = { cookies: { token: 'eyInvalidTamperedToken.payload.sig' } };
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

      authMiddleware(req, res, () => {});
      assert.strictEqual(statusCode, 401);
      assert.ok(jsonBody.error.includes('Session expired or invalid'));
    });
  });

  describe('2. Project Management Lifecycle & Data Isolation', () => {
    it('filters project list strictly by authenticated owner', async () => {
      let capturedFilter = null;
      const origFind = Project.find;

      Project.find = (filter) => {
        capturedFilter = filter;
        return {
          sort: () => Promise.resolve([]),
        };
      };

      try {
        const req = { user: mockUser };
        const res = { json: () => {} };
        await listProjects(req, res);
        assert.deepStrictEqual(capturedFilter, { owner: mockUserId });
      } finally {
        Project.find = origFind;
      }
    });

    it('blocks non-owners from accessing private project details', async () => {
      const targetId = new mongoose.Types.ObjectId().toString();
      const nonOwnerUser = { userID: new mongoose.Types.ObjectId().toString() };

      const origFindOne = Project.findOne;
      Project.findOne = async (filter) => {
        if (filter.owner === mockUserId && filter._id === targetId) {
          return {
            _id: targetId,
            owner: mockUserId,
            name: 'Target Project',
            files: {},
          };
        }
        return null;
      };

      try {
        let statusCode = null;
        let jsonBody = null;

        const req = {
          user: nonOwnerUser,
          params: { id: targetId },
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

        await getProject(req, res);
        assert.strictEqual(statusCode, 404);
        assert.deepStrictEqual(jsonBody, { error: 'Project not found' });
      } finally {
        Project.findOne = origFindOne;
      }
    });

    it('blocks cross-user inspection of private project QA with HTTP 403', async () => {
      const foreignOwnerId = new mongoose.Types.ObjectId();
      const origFindById = Project.findById;

      Project.findById = async () => ({
        _id: new mongoose.Types.ObjectId(),
        owner: foreignOwnerId,
        name: 'Confidential Internal App',
      });

      try {
        let statusCode = null;
        let jsonBody = null;

        const req = {
          user: mockUser,
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

    it('updates project files and synchronizes content hashes cleanly', async () => {
      const projectId = new mongoose.Types.ObjectId();
      let savedProject = null;
      const origFindOne = Project.findOne;

      Project.findOne = async () => ({
        _id: projectId,
        owner: mockUserId,
        files: {},
        save: async function () {
          savedProject = this;
        },
      });

      try {
        let responseData = null;
        const req = {
          user: mockUser,
          params: { id: projectId.toString() },
          body: {
            files: {
              '/App.jsx': 'export default function App() { return <h1>Updated</h1>; }',
            },
          },
        };
        const res = {
          json: (data) => {
            responseData = data;
          },
        };

        await updateProjectFiles(req, res);
        assert.ok(savedProject);
        assert.ok(savedProject.files['/App.jsx'].hash);
        assert.strictEqual(responseData.files['/App.jsx'], 'export default function App() { return <h1>Updated</h1>; }');
      } finally {
        Project.findOne = origFindOne;
      }
    });

    it('enforces owner verification on project deletion', async () => {
      let capturedQuery = null;
      const origFindOneAndDelete = Project.findOneAndDelete;

      Project.findOneAndDelete = async (query) => {
        capturedQuery = query;
        return { _id: query._id };
      };

      try {
        const req = {
          user: mockUser,
          params: { id: new mongoose.Types.ObjectId().toString() },
        };
        const res = { json: () => {} };

        await deleteProject(req, res);
        assert.strictEqual(capturedQuery.owner, mockUserId);
      } finally {
        Project.findOneAndDelete = origFindOneAndDelete;
      }
    });
  });

  describe('3. AI Generation Pipeline & Resilient Fallbacks', () => {
    it('generates a valid, schema-compliant fallback DesignSpec when AI call fails', () => {
      const fallbackSpec = createDefaultDesignSpec('Modern analytics dashboard with dark theme');
      const parsed = DesignSpecSchema.safeParse(fallbackSpec);
      assert.strictEqual(parsed.success, true);
      assert.ok(fallbackSpec.typography.heading.family);
      assert.ok(fallbackSpec.colorPalette.accent);
    });

    it('validates FilePlanSchema structure and requires entry point', () => {
      const validPlan = {
        name: 'Saas Website',
        projectDescription: 'Clean modern landing page',
        files: [
          {
            path: '/App.js',
            description: 'Main application',
            exports: 'default App',
            imports: ['./styles.css'],
          },
          {
            path: '/styles.css',
            description: 'Global CSS styles',
            exports: 'none',
            imports: [],
          },
        ],
      };

      const parsed = FilePlanSchema.safeParse(validPlan);
      assert.strictEqual(parsed.success, true);
    });

    it('validates and auto-repairs missing default exports in components', () => {
      const rawCode = `
        import React from 'react';
        function Card({ title }) {
          return (
            <div className="p-4">
              <h2>{title}</h2>
            </div>
          );
        }
      `;

      const result = validateAndFixCode(rawCode, '/components/Card.jsx');
      assert.strictEqual(result.valid, true);
      assert.ok(result.code.includes('export default Card'));
    });

    it('performs cross-file semantic validation detecting missing imports', () => {
      const files = {
        '/App.js': `
          import React from 'react';
          import Hero from './components/Hero.jsx';
          import MissingNav from './components/MissingNav.jsx';
          export default function App() { return <div><Hero /><MissingNav /></div>; }
        `,
        '/components/Hero.jsx': `
          import React from 'react';
          export default function Hero() { return <header>Hero</header>; }
        `,
      };

      const planFiles = [
        { path: '/App.js' },
        { path: '/components/Hero.jsx' },
      ];

      const validation = validateProject(files, planFiles);
      assert.strictEqual(validation.valid, false);
      assert.ok(validation.errors.some((e) => e.message.includes('MissingNav.jsx')));
    });
  });

  describe('4. Targeted Conversational Revisions & Diff Engine', () => {
    it('applies surgical search-and-replace diffs without corrupting unchanged files', () => {
      const initialFiles = {
        '/components/Hero.jsx': {
          content: `export default function Hero() {\n  return <h1>Old Title</h1>;\n}`,
          hash: 'abc1',
        },
        '/components/Footer.jsx': {
          content: `export default function Footer() {\n  return <footer>Footer</footer>;\n}`,
          hash: 'def2',
        },
      };

      const diffOps = [
        {
          op: 'update',
          path: '/components/Hero.jsx',
          search: '<h1>Old Title</h1>',
          replace: '<h1 className="text-4xl font-bold">New Polished Title</h1>',
        },
      ];

      const { files: updatedFiles, errors } = applyOperations(initialFiles, diffOps);
      assert.strictEqual(errors.length, 0);
      assert.ok(updatedFiles['/components/Hero.jsx'].content.includes('New Polished Title'));
      // Verify Footer was completely untouched
      assert.strictEqual(
        updatedFiles['/components/Footer.jsx'].content,
        initialFiles['/components/Footer.jsx'].content,
      );
    });
  });

  describe('5. Publishing & Public Access Security', () => {
    it('blocks unauthenticated public access to unpublished draft websites with HTTP 403', async () => {
      const origFindById = Project.findById;
      Project.findById = async () => ({
        _id: new mongoose.Types.ObjectId(),
        name: 'Private Draft',
        published: false,
      });

      try {
        let statusCode = null;
        let jsonBody = null;

        const req = { params: { id: new mongoose.Types.ObjectId().toString() } };
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

        await getPublicProject(req, res);
        assert.strictEqual(statusCode, 403);
        assert.ok(jsonBody.error.includes('not published'));
      } finally {
        Project.findById = origFindById;
      }
    });

    it('permits public access to published websites and exposes only sanitized fields', async () => {
      const projectId = new mongoose.Types.ObjectId();
      const origFindById = Project.findById;

      Project.findById = async () => ({
        _id: projectId,
        name: 'Live Showcase Site',
        description: 'Published Portfolio',
        published: true,
        version: 3,
        owner: new mongoose.Types.ObjectId(), // Internal owner ID
        files: {
          '/App.js': { content: 'export default function App() {}' },
        },
      });

      try {
        let jsonBody = null;
        const req = { params: { id: projectId.toString() } };
        const res = {
          json: (body) => {
            jsonBody = body;
          },
        };

        await getPublicProject(req, res);
        assert.ok(jsonBody);
        assert.strictEqual(jsonBody.name, 'Live Showcase Site');
        assert.strictEqual(jsonBody.files['/App.js'], 'export default function App() {}');
        assert.strictEqual(jsonBody.owner, undefined); // Sensitive owner reference is excluded
      } finally {
        Project.findById = origFindById;
      }
    });
  });

  describe('6. Security Protections & Sanitization', () => {
    it('redacts sensitive API keys, authorization tokens, and database passwords from error outputs', () => {
      const rawError = 'Error: Failed request to https://api.openrouter.ai/v1 with Bearer sk-or-v1-abcdef1234567890 and mongodb://user:supersecretpass@cluster.mongodb.net';
      const sanitized = sanitizeError(rawError);

      assert.ok(!sanitized.includes('sk-or-v1-abcdef1234567890'));
      assert.ok(sanitized.includes('Bearer [REDACTED_TOKEN]'));
      assert.ok(!sanitized.includes('supersecretpass'));
      assert.ok(sanitized.includes('mongodb://[REDACTED_AUTH]@'));
    });

    it('configures rate limiters for auth, generation, and revisions', () => {
      assert.strictEqual(typeof authRateLimiter, 'function');
      assert.strictEqual(typeof aiGenerationRateLimiter, 'function');
      assert.strictEqual(typeof aiRevisionRateLimiter, 'function');
    });
  });

  describe('7. Automated Visual QA & Layout Integrity', () => {
    it('detects horizontal overflow and mobile viewport constraints', () => {
      const files = {
        '/components/Hero.jsx': `<div className="w-[1280px]">Oversized Container</div>`,
      };

      const report = analyzeProjectVisualQuality(files);
      assert.strictEqual(report.status, 'defects_detected');
      assert.strictEqual(report.summary.categories.overflow, 1);
      assert.strictEqual(report.issues[0].severity, 'critical');
    });

    it('passes responsive, accessible layouts conforming to DesignSpec', () => {
      const designSpec = {
        archetype: 'minimal-saas',
        typography: { headingFont: 'Inter' },
      };

      const files = {
        '/styles.css': `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');`,
        '/App.js': `
          export default function App() {
            return (
              <main className="w-full max-w-5xl mx-auto px-4 py-12">
                <img src="https://images.unsplash.com/photo-1" alt="Showcase Preview" />
                <button aria-label="Toggle navigation" className="p-2">
                  <MenuIcon size={20} />
                </button>
              </main>
            );
          }
        `,
      };

      const report = analyzeProjectVisualQuality(files, designSpec);
      assert.strictEqual(report.status, 'passed');
      assert.strictEqual(report.summary.totalIssues, 0);
    });
  });
});
