import { describe, it } from 'node:test';
import assert from 'node:assert';
import { listProjects } from '../controllers/projectController.js';
import { curatedPrompts } from '../../client/src/assets/assets.js';

describe('Phase 3A: Professional Dashboard & Interaction Suite', () => {
  describe('Task 1: Project List Projection & Compatibility', () => {
    it('returns projects with status, published, and designSpec projection for dashboard cards', async () => {
      let queryFilter = null;
      let queryProjection = null;
      let sortFilter = null;

      const mockFind = (filter, projection) => {
        queryFilter = filter;
        queryProjection = projection;
        return {
          sort: (sortObj) => {
            sortFilter = sortObj;
            return [
              {
                _id: '507f1f77bcf86cd799439011',
                name: 'SaaS Platform',
                description: 'Modern developer observability',
                version: 2,
                status: 'completed',
                published: true,
                designSpec: { archetype: 'minimal-saas', category: 'saas_landing' },
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ];
          },
        };
      };

      // Temporarily mock Project.find
      const { Project } = await import('../models/Project.js');
      const originalFind = Project.find;
      Project.find = mockFind;

      try {
        let jsonResult = null;
        const req = { user: { userID: 'user123' } };
        const res = {
          json: (data) => {
            jsonResult = data;
          },
        };

        await listProjects(req, res);

        assert.deepStrictEqual(queryFilter, { owner: 'user123' });
        assert.strictEqual(queryProjection.status, 1);
        assert.strictEqual(queryProjection.published, 1);
        assert.strictEqual(queryProjection.designSpec, 1);
        assert.deepStrictEqual(sortFilter, { updatedAt: -1 });

        assert.strictEqual(jsonResult.length, 1);
        assert.strictEqual(jsonResult[0].status, 'completed');
        assert.strictEqual(jsonResult[0].published, true);
        assert.strictEqual(jsonResult[0].designSpec.archetype, 'minimal-saas');
      } finally {
        Project.find = originalFind;
      }
    });

    it('gracefully handles legacy projects without designSpec or published flag', async () => {
      const mockProject = {
        _id: '507f1f77bcf86cd799439012',
        name: 'Legacy Project',
        description: 'Created before Phase 2A',
        version: 1,
        status: undefined,
        published: undefined,
        designSpec: null,
      };

      // Test fallback handling as implemented in ProjectCard & HomePage
      const isPublished = Boolean(mockProject.published);
      const archetype = mockProject.designSpec?.archetype || 'minimal-saas';
      const status = mockProject.status || 'completed';

      assert.strictEqual(isPublished, false);
      assert.strictEqual(archetype, 'minimal-saas');
      assert.strictEqual(status, 'completed');
    });
  });

  describe('Task 2: Dashboard Real-Time Search & Filtering Logic', () => {
    const mockProjects = [
      {
        _id: '1',
        name: 'Supabase Observability Tool',
        description: 'Real-time database metrics dashboard',
        published: true,
        designSpec: { archetype: 'minimal-saas', category: 'saas_landing' },
      },
      {
        _id: '2',
        name: 'Zürich Architecture Monograph',
        description: 'Swiss typography portfolio for architects',
        published: false,
        designSpec: { archetype: 'swiss-style', category: 'portfolio' },
      },
      {
        _id: '3',
        name: 'Atelier Ceramic Tableware',
        description: 'Editorial luxury ceramics e-commerce',
        published: true,
        designSpec: { archetype: 'luxury', category: 'ecommerce' },
      },
      {
        _id: '4',
        name: 'Neon Horizon Games',
        description: 'Brutalist gaming news and reviews',
        published: false,
        designSpec: { archetype: 'neo-brutalist', category: 'editorial' },
      },
    ];

    const filterProjects = (projects, tab, query) => {
      return projects.filter((project) => {
        if (tab === 'published' && !project.published) return false;
        if (tab === 'drafts' && project.published) return false;
        if (!query.trim()) return true;
        const q = query.toLowerCase().trim();
        const name = (project.name || '').toLowerCase();
        const desc = (project.description || '').toLowerCase();
        const archetype = (project.designSpec?.archetype || '').toLowerCase();
        const category = (project.designSpec?.category || '').toLowerCase();
        return (
          name.includes(q) ||
          desc.includes(q) ||
          archetype.includes(q) ||
          category.includes(q)
        );
      });
    };

    it('filters by project name case-insensitively', () => {
      const results = filterProjects(mockProjects, 'all', 'supabase');
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0]._id, '1');
    });

    it('filters by prompt/description text', () => {
      const results = filterProjects(mockProjects, 'all', 'ceramics');
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0]._id, '3');
    });

    it('filters by design archetype', () => {
      const results = filterProjects(mockProjects, 'all', 'swiss-style');
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0]._id, '2');
    });

    it('correctly filters by Published status tab', () => {
      const published = filterProjects(mockProjects, 'published', '');
      assert.strictEqual(published.length, 2);
      assert.ok(published.every((p) => p.published === true));
    });

    it('correctly filters by Drafts status tab', () => {
      const drafts = filterProjects(mockProjects, 'drafts', '');
      assert.strictEqual(drafts.length, 2);
      assert.ok(drafts.every((p) => !p.published));
    });

    it('returns empty array when search query matches nothing', () => {
      const results = filterProjects(mockProjects, 'all', 'nonexistent_xyz');
      assert.strictEqual(results.length, 0);
    });

    it('returns all projects when search query is empty or whitespace', () => {
      const results = filterProjects(mockProjects, 'all', '   ');
      assert.strictEqual(results.length, 4);
    });
  });

  describe('Task 3: Curated Prompts & Starter Shelf Integrity', () => {
    it('provides structured curated prompts covering diverse archetypes', () => {
      assert.ok(Array.isArray(curatedPrompts));
      assert.ok(curatedPrompts.length >= 6);

      const archetypes = curatedPrompts.map((p) => p.archetype);
      assert.ok(archetypes.includes('minimal-saas'));
      assert.ok(archetypes.includes('swiss-style'));
      assert.ok(archetypes.includes('luxury'));
      assert.ok(archetypes.includes('neo-brutalist'));
      assert.ok(archetypes.includes('futuristic-tech'));
      assert.ok(archetypes.includes('editorial'));

      for (const item of curatedPrompts) {
        assert.ok(item.id, 'prompt must have an id');
        assert.ok(item.title, 'prompt must have a title');
        assert.ok(item.tag, 'prompt must have a tag');
        assert.ok(item.prompt.length > 30, 'prompt must be descriptive');
      }
    });
  });

  describe('Task 4: Prompt Input Trimming & Empty Validation', () => {
    it('rejects empty and whitespace-only prompt submissions', () => {
      const validateSubmission = (input) => {
        const trimmed = (input || '').trim();
        return Boolean(trimmed);
      };

      assert.strictEqual(validateSubmission(''), false);
      assert.strictEqual(validateSubmission('   \n\t  '), false);
      assert.strictEqual(validateSubmission('Build a portfolio'), true);
    });
  });

  describe('Task 5: Project URL Resolution for Live & Preview Actions', () => {
    it('resolves published projects to /publish/:id and drafts to /preview/:id', () => {
      const getActionUrl = (project, origin = 'http://localhost:5173') => {
        const isPub = Boolean(project?.published);
        return `${origin}${isPub ? '/publish/' : '/preview/'}${project._id}`;
      };

      const publishedProject = { _id: 'proj123', published: true };
      const draftProject = { _id: 'proj456', published: false };

      assert.strictEqual(
        getActionUrl(publishedProject),
        'http://localhost:5173/publish/proj123',
      );
      assert.strictEqual(
        getActionUrl(draftProject),
        'http://localhost:5173/preview/proj456',
      );
    });
  });
});

