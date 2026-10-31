import { describe, it } from 'node:test';
import assert from 'node:assert';
import { formatSSE, emitProjectEvent, subscribeProjectEvents } from '../services/projectEvents.js';
import { streamProjectProgress } from '../controllers/projectController.js';

describe('Phase 4A: Real-Time SSE Progress Engine Suite', () => {
  describe('Task 1: SSE Wire Protocol & Event Formatting', () => {
    it('formats W3C compliant SSE frames with optional event and id', () => {
      const basic = formatSSE('test_event', { key: 'value' });
      assert.strictEqual(basic, 'event: test_event\ndata: {"key":"value"}\n\n');

      const withId = formatSSE('update', { counter: 42 }, 101);
      assert.strictEqual(withId, 'id: 101\nevent: update\ndata: {"counter":42}\n\n');

      const textData = formatSSE(null, 'heartbeat');
      assert.strictEqual(textData, 'data: heartbeat\n\n');
    });
  });

  describe('Task 2: In-Process Event Bus & Subscriber Management', () => {
    it('delivers events to subscribers and cleanly unsubscribes without memory leaks', () => {
      const projectId = '507f1f77bcf86cd799439011';
      const received = [];

      const unsubscribe = subscribeProjectEvents(projectId, (payload) => {
        received.push(payload);
      });

      emitProjectEvent(projectId, 'file_start', { currentFile: '/components/Hero.jsx' });
      emitProjectEvent(projectId, 'file_complete', { path: '/components/Hero.jsx' });

      assert.strictEqual(received.length, 2);
      assert.strictEqual(received[0].event, 'file_start');
      assert.strictEqual(received[0].data.currentFile, '/components/Hero.jsx');
      assert.strictEqual(received[1].event, 'file_complete');
      assert.strictEqual(received[1].data.path, '/components/Hero.jsx');

      // Unsubscribe and verify no further events are received
      unsubscribe();
      emitProjectEvent(projectId, 'completed', { status: 'completed' });
      assert.strictEqual(received.length, 2);
    });

    it('isolates events between distinct project IDs', () => {
      const projA = 'project_aaa';
      const projB = 'project_bbb';
      const eventsA = [];
      const eventsB = [];

      const unsubA = subscribeProjectEvents(projA, (p) => eventsA.push(p));
      const unsubB = subscribeProjectEvents(projB, (p) => eventsB.push(p));

      emitProjectEvent(projA, 'plan', { name: 'App A' });
      emitProjectEvent(projB, 'plan', { name: 'App B' });

      assert.strictEqual(eventsA.length, 1);
      assert.strictEqual(eventsA[0].data.name, 'App A');
      assert.strictEqual(eventsB.length, 1);
      assert.strictEqual(eventsB[0].data.name, 'App B');

      unsubA();
      unsubB();
    });
  });

  describe('Task 3: Authentication & Cross-User Security', () => {
    it('rejects unauthenticated requests with HTTP 401', async () => {
      let statusCode = null;
      let jsonBody = null;

      const req = { user: null, params: { id: '507f1f77bcf86cd799439011' } };
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

      await streamProjectProgress(req, res);
      assert.strictEqual(statusCode, 401);
      assert.strictEqual(jsonBody.error, 'Unauthorized');
    });

    it('rejects cross-user project stream access with HTTP 403 Forbidden', async () => {
      const { Project } = await import('../models/Project.js');
      const originalFindById = Project.findById;

      // Project owned by user_owner
      Project.findById = async () => ({
        _id: '507f1f77bcf86cd799439011',
        owner: 'user_owner',
        status: 'generating',
      });

      try {
        let statusCode = null;
        let jsonBody = null;

        // Attacker user_attacker tries to access user_owner's project stream
        const req = {
          user: { userID: 'user_attacker' },
          params: { id: '507f1f77bcf86cd799439011' },
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

        await streamProjectProgress(req, res);
        assert.strictEqual(statusCode, 403);
        assert.strictEqual(jsonBody.error, 'Access denied');
      } finally {
        Project.findById = originalFindById;
      }
    });

    it('rejects invalid ObjectId parameters with HTTP 404', async () => {
      let statusCode = null;
      const req = {
        user: { userID: 'user123' },
        params: { id: 'invalid-id' },
      };
      const res = {
        status: (code) => {
          statusCode = code;
          return { json: () => {} };
        },
      };

      await streamProjectProgress(req, res);
      assert.strictEqual(statusCode, 404);
    });
  });

  describe('Task 4: Ground Truth State & Terminal Event Streaming', () => {
    it('sets proper SSE headers and delivers initial_state snapshot from database', async () => {
      const { Project } = await import('../models/Project.js');
      const originalFindById = Project.findById;

      const mockProject = {
        _id: '507f1f77bcf86cd799439011',
        owner: 'user123',
        status: 'generating',
        name: 'Active Project',
        version: 1,
        filesPlanned: [{ path: '/App.js', description: 'Main' }],
        filesGenerated: [],
        currentFile: '/App.js',
        error: null,
      };

      Project.findById = async () => mockProject;

      try {
        let headersWritten = null;
        const writtenChunks = [];
        let connectionClosed = false;

        const req = {
          user: { userID: 'user123' },
          params: { id: '507f1f77bcf86cd799439011' },
          on: (event, handler) => {
            if (event === 'close') {
              // Store handler to simulate close
              req.closeHandler = handler;
            }
          },
        };

        const res = {
          writeHead: (code, headers) => {
            headersWritten = { code, headers };
          },
          write: (chunk) => {
            writtenChunks.push(chunk);
          },
          end: () => {
            connectionClosed = true;
          },
        };

        await streamProjectProgress(req, res);

        // Verify SSE headers
        assert.strictEqual(headersWritten.code, 200);
        assert.strictEqual(headersWritten.headers['Content-Type'], 'text/event-stream');
        assert.strictEqual(headersWritten.headers['Cache-Control'], 'no-cache, no-transform');
        assert.strictEqual(headersWritten.headers['Connection'], 'keep-alive');

        // Verify initial_state event
        assert.ok(writtenChunks.length >= 1);
        assert.ok(writtenChunks[0].startsWith('event: initial_state\n'));
        assert.ok(writtenChunks[0].includes('"name":"Active Project"'));
        assert.ok(writtenChunks[0].includes('"currentFile":"/App.js"'));

        // Simulate event emission
        emitProjectEvent('507f1f77bcf86cd799439011', 'file_complete', {
          path: '/App.js',
          filesGenerated: ['/App.js'],
        });
        assert.ok(writtenChunks.some((c) => c.includes('event: file_complete\n')));

        // Simulate completion -> triggers stream close
        emitProjectEvent('507f1f77bcf86cd799439011', 'completed', {
          status: 'completed',
          version: 1,
        });
        assert.strictEqual(connectionClosed, true);

        // Clean up connection
        req.closeHandler?.();
      } finally {
        Project.findById = originalFindById;
      }
    });

    it('immediately ends stream when project is already completed or failed in database', async () => {
      const { Project } = await import('../models/Project.js');
      const originalFindById = Project.findById;

      Project.findById = async () => ({
        _id: '507f1f77bcf86cd799439011',
        owner: 'user123',
        status: 'completed',
        name: 'Done Project',
        version: 1,
        filesPlanned: [],
        filesGenerated: ['/App.js'],
      });

      try {
        let connectionClosed = false;
        const chunks = [];

        const req = {
          user: { userID: 'user123' },
          params: { id: '507f1f77bcf86cd799439011' },
          on: () => {},
        };

        const res = {
          writeHead: () => {},
          write: (chunk) => chunks.push(chunk),
          end: () => {
            connectionClosed = true;
          },
        };

        await streamProjectProgress(req, res);

        assert.strictEqual(connectionClosed, true);
        assert.ok(chunks.some((c) => c.includes('event: completed\n')));
      } finally {
        Project.findById = originalFindById;
      }
    });
  });
});

