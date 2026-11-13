import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import {
  emitProjectEvent,
  subscribeProjectEvents,
  getMissedProjectEvents,
  getProjectReplayBuffer,
  clearProjectReplayBuffer,
  formatSSE,
  MAX_BUFFER_SIZE,
  BUFFER_TTL_MS,
  getProjectSubscriberCount,
} from '../services/projectEvents.js';
import { streamProjectProgress } from '../controllers/projectController.js';
import { Project } from '../models/Project.js';

describe('Phase 3A: Resilient SSE Replay Buffer & Last-Event-ID Recovery Suite', () => {
  beforeEach(() => {
    clearProjectReplayBuffer();
  });

  afterEach(() => {
    clearProjectReplayBuffer();
  });

  describe('Task 1: Monotonic Sequence Generation & W3C Frame Formatting', () => {
    it('assigns incrementing monotonic IDs in `${projectId}:${seq}` format', () => {
      const projectId = '507f1f77bcf86cd799439001';

      const evt1 = emitProjectEvent(projectId, 'requirement_contract', { category: 'saas' });
      const evt2 = emitProjectEvent(projectId, 'design_spec', { archetype: 'modern' });
      const evt3 = emitProjectEvent(projectId, 'plan', { steps: 3 });

      assert.strictEqual(evt1.id, `${projectId}:1`);
      assert.strictEqual(evt1.seq, 1);
      assert.strictEqual(evt2.id, `${projectId}:2`);
      assert.strictEqual(evt2.seq, 2);
      assert.strictEqual(evt3.id, `${projectId}:3`);
      assert.strictEqual(evt3.seq, 3);
    });

    it('formats W3C SSE frames with id: line placed before event: and data:', () => {
      const id = 'proj_abc:42';
      const event = 'file_start';
      const data = { currentFile: '/src/App.jsx' };

      const frame = formatSSE(event, data, id);

      const expected = `id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      assert.strictEqual(frame, expected);

      // Verify exact line ordering: id line -> event line -> data line
      const lines = frame.split('\n');
      assert.strictEqual(lines[0], `id: ${id}`);
      assert.strictEqual(lines[1], `event: ${event}`);
      assert.strictEqual(lines[2], `data: ${JSON.stringify(data)}`);
    });

    it('maintains independent monotonic sequence counters for different projects', () => {
      const projA = '507f1f77bcf86cd79943900a';
      const projB = '507f1f77bcf86cd79943900b';

      const a1 = emitProjectEvent(projA, 'file_start', { file: 'A1' });
      const b1 = emitProjectEvent(projB, 'file_start', { file: 'B1' });
      const a2 = emitProjectEvent(projA, 'file_complete', { file: 'A1' });
      const b2 = emitProjectEvent(projB, 'file_complete', { file: 'B1' });

      assert.strictEqual(a1.id, `${projA}:1`);
      assert.strictEqual(a2.id, `${projA}:2`);
      assert.strictEqual(b1.id, `${projB}:1`);
      assert.strictEqual(b2.id, `${projB}:2`);
    });
  });

  describe('Task 2: Bounded Ring Buffer & Eviction Mechanics', () => {
    it('bounds buffer to MAX_BUFFER_SIZE (50) and evicts oldest entries past 50', () => {
      const projectId = '507f1f77bcf86cd799439002';
      assert.strictEqual(MAX_BUFFER_SIZE, 50);

      // Emit 70 events sequentially
      for (let i = 1; i <= 70; i++) {
        emitProjectEvent(projectId, 'file_progress', { count: i });
      }

      const buffer = getProjectReplayBuffer(projectId);
      assert.strictEqual(buffer.length, 50);

      // Oldest entry must be seq 21 (events 1-20 evicted)
      assert.strictEqual(buffer[0].seq, 21);
      assert.strictEqual(buffer[0].id, `${projectId}:21`);
      assert.strictEqual(buffer[0].data.count, 21);

      // Newest entry must be seq 70
      assert.strictEqual(buffer[buffer.length - 1].seq, 70);
      assert.strictEqual(buffer[buffer.length - 1].id, `${projectId}:70`);
      assert.strictEqual(buffer[buffer.length - 1].data.count, 70);
    });

    it('clears replay buffer and cancels timers with clearProjectReplayBuffer', () => {
      const projectId = '507f1f77bcf86cd799439003';
      emitProjectEvent(projectId, 'plan', { test: true });

      assert.strictEqual(getProjectReplayBuffer(projectId).length, 1);
      clearProjectReplayBuffer(projectId);
      assert.strictEqual(getProjectReplayBuffer(projectId).length, 0);
    });

    it('configures TTL to 15 minutes', () => {
      assert.strictEqual(BUFFER_TTL_MS, 15 * 60 * 1000);
    });
  });

  describe('Task 3: getMissedProjectEvents Recovery Logic', () => {
    it('returns missed events strictly after Last-Event-ID in chronological order', () => {
      const projectId = '507f1f77bcf86cd799439004';
      for (let i = 1; i <= 10; i++) {
        emitProjectEvent(projectId, 'step', { step: i });
      }

      // Reconnect with last event ID = 6
      const missed = getMissedProjectEvents(projectId, `${projectId}:6`);
      assert.ok(Array.isArray(missed));
      assert.strictEqual(missed.length, 4);
      assert.deepStrictEqual(
        missed.map((m) => m.seq),
        [7, 8, 9, 10]
      );
      assert.deepStrictEqual(
        missed.map((m) => m.id),
        [`${projectId}:7`, `${projectId}:8`, `${projectId}:9`, `${projectId}:10`]
      );
    });

    it('returns empty array [] if client is already up to date with newest event', () => {
      const projectId = '507f1f77bcf86cd799439005';
      emitProjectEvent(projectId, 'event_1', {});
      emitProjectEvent(projectId, 'event_2', {});

      const missed = getMissedProjectEvents(projectId, `${projectId}:2`);
      assert.ok(Array.isArray(missed));
      assert.strictEqual(missed.length, 0);
    });

    it('returns all buffered events when client reconnects at oldestSeq - 1', () => {
      const projectId = '507f1f77bcf86cd799439006';
      // Emit 70 events so buffer holds seqs 21..70 (oldestSeq = 21)
      for (let i = 1; i <= 70; i++) {
        emitProjectEvent(projectId, 'ping', { i });
      }

      // Client last saw event 20 (oldestSeq - 1)
      const missed = getMissedProjectEvents(projectId, `${projectId}:20`);
      assert.ok(Array.isArray(missed));
      assert.strictEqual(missed.length, 50);
      assert.strictEqual(missed[0].seq, 21);
      assert.strictEqual(missed[49].seq, 70);
    });

    it('returns null when Last-Event-ID points to an evicted sequence older than buffer window', () => {
      const projectId = '507f1f77bcf86cd799439007';
      for (let i = 1; i <= 70; i++) {
        emitProjectEvent(projectId, 'ping', { i });
      }

      // Buffer holds 21..70. Events 1-20 are evicted.
      // Requesting seq 19 or seq 5 must return null to indicate unrecoverable buffer gap
      assert.strictEqual(getMissedProjectEvents(projectId, `${projectId}:19`), null);
      assert.strictEqual(getMissedProjectEvents(projectId, `${projectId}:5`), null);
      assert.strictEqual(getMissedProjectEvents(projectId, `${projectId}:0`), null);
    });

    it('returns null for malformed or cross-project Last-Event-ID', () => {
      const projectId = '507f1f77bcf86cd799439008';
      emitProjectEvent(projectId, 'init', {});

      // Wrong project ID
      assert.strictEqual(getMissedProjectEvents(projectId, 'other_project:1'), null);

      // Non-numeric sequence
      assert.strictEqual(getMissedProjectEvents(projectId, `${projectId}:abc`), null);

      // Negative sequence
      assert.strictEqual(getMissedProjectEvents(projectId, `${projectId}:-5`), null);

      // Trailing junk
      assert.strictEqual(getMissedProjectEvents(projectId, `${projectId}:1:junk`), null);

      // Missing sequence
      assert.strictEqual(getMissedProjectEvents(projectId, `${projectId}:`), null);

      // Missing colon / invalid string
      assert.strictEqual(getMissedProjectEvents(projectId, 'invalid_id_format'), null);

      // Future sequence (greater than newest event)
      assert.strictEqual(getMissedProjectEvents(projectId, `${projectId}:999`), null);

      // Null / undefined / empty
      assert.strictEqual(getMissedProjectEvents(projectId, null), null);
      assert.strictEqual(getMissedProjectEvents(projectId, undefined), null);
      assert.strictEqual(getMissedProjectEvents(projectId, ''), null);
      assert.strictEqual(getMissedProjectEvents(null, `${projectId}:1`), null);
    });

    it('returns null if buffer has been purged or is empty', () => {
      const projectId = '507f1f77bcf86cd799439009';
      // No events emitted yet
      assert.strictEqual(getMissedProjectEvents(projectId, `${projectId}:1`), null);

      // Emit and clear
      emitProjectEvent(projectId, 'test', {});
      clearProjectReplayBuffer(projectId);
      assert.strictEqual(getMissedProjectEvents(projectId, `${projectId}:1`), null);
    });
  });

  describe('Task 4: SSE Endpoint Replay, Deduplication & Lifecycle', () => {
    it('replays missed events with Last-Event-ID header and attaches live listener', async () => {
      const projectId = '507f1f77bcf86cd799439010';
      const originalFindById = Project.findById;

      Project.findById = async () => ({
        _id: projectId,
        owner: 'user_replay_test',
        status: 'generating',
        name: 'Replay App',
        version: 1,
        filesPlanned: [],
        filesGenerated: [],
      });

      try {
        // Pre-populate events in replay buffer: 1, 2, 3, 4
        emitProjectEvent(projectId, 'requirement_contract', { category: 'saas' });
        emitProjectEvent(projectId, 'design_spec', { theme: 'dark' });
        emitProjectEvent(projectId, 'plan', { totalFiles: 3 });
        emitProjectEvent(projectId, 'file_start', { currentFile: '/src/Index.jsx' });

        const written = [];
        let closeHandler = null;

        const req = {
          user: { userID: 'user_replay_test' },
          params: { id: projectId },
          headers: {
            'last-event-id': `${projectId}:2`,
          },
          on: (event, handler) => {
            if (event === 'close') closeHandler = handler;
          },
        };

        const res = {
          writeHead: () => {},
          write: (chunk) => written.push(chunk),
          end: () => {},
          on: () => {},
        };

        await streamProjectProgress(req, res);

        // 1. Initial state frame should be written first
        assert.ok(written[0].startsWith('event: initial_state\n'));

        // 2. Events 3 and 4 should be replayed in order with proper IDs
        const replayPlan = written.find((c) => c.includes(`id: ${projectId}:3`));
        assert.ok(replayPlan, 'Should replay event 3');
        assert.ok(replayPlan.includes('event: plan\n'));

        const replayFileStart = written.find((c) => c.includes(`id: ${projectId}:4`));
        assert.ok(replayFileStart, 'Should replay event 4');
        assert.ok(replayFileStart.includes('event: file_start\n'));

        // Events 1 and 2 should NOT be replayed
        assert.ok(!written.some((c) => c.includes(`id: ${projectId}:1`)));
        assert.ok(!written.some((c) => c.includes(`id: ${projectId}:2`)));

        // 3. Emit a new live event (event 5)
        emitProjectEvent(projectId, 'file_complete', { path: '/src/Index.jsx' });
        const liveEvent = written.find((c) => c.includes(`id: ${projectId}:5`));
        assert.ok(liveEvent, 'Should receive live event 5');
        assert.ok(liveEvent.includes('event: file_complete\n'));

        closeHandler?.();
      } finally {
        Project.findById = originalFindById;
      }
    });

    it('supports query fallback req.query.lastEventId for reconnection replay', async () => {
      const projectId = '507f1f77bcf86cd799439011';
      const originalFindById = Project.findById;

      Project.findById = async () => ({
        _id: projectId,
        owner: 'user_query_test',
        status: 'generating',
        name: 'Query Fallback App',
        version: 1,
      });

      try {
        emitProjectEvent(projectId, 'step_1', { step: 1 });
        emitProjectEvent(projectId, 'step_2', { step: 2 });
        emitProjectEvent(projectId, 'step_3', { step: 3 });

        const written = [];
        let closeHandler = null;

        const req = {
          user: { userID: 'user_query_test' },
          params: { id: projectId },
          headers: {},
          query: {
            lastEventId: `${projectId}:1`,
          },
          on: (event, handler) => {
            if (event === 'close') closeHandler = handler;
          },
        };

        const res = {
          writeHead: () => {},
          write: (chunk) => written.push(chunk),
          end: () => {},
          on: () => {},
        };

        await streamProjectProgress(req, res);

        // Should have replayed step_2 (seq 2) and step_3 (seq 3)
        assert.ok(written.some((c) => c.includes(`id: ${projectId}:2`)));
        assert.ok(written.some((c) => c.includes(`id: ${projectId}:3`)));
        assert.ok(!written.some((c) => c.includes(`id: ${projectId}:1`)));

        closeHandler?.();
      } finally {
        Project.findById = originalFindById;
      }
    });

    it('deduplicates replayed events so race conditions never send duplicates to client', async () => {
      const projectId = '507f1f77bcf86cd799439012';
      const originalFindById = Project.findById;

      Project.findById = async () => ({
        _id: projectId,
        owner: 'user_dedup_test',
        status: 'generating',
        name: 'Dedup App',
        version: 1,
      });

      try {
        emitProjectEvent(projectId, 'milestone_1', { data: 'one' });
        emitProjectEvent(projectId, 'milestone_2', { data: 'two' });

        const written = [];
        let closeHandler = null;

        const req = {
          user: { userID: 'user_dedup_test' },
          params: { id: projectId },
          headers: { 'last-event-id': `${projectId}:1` },
          on: (event, handler) => {
            if (event === 'close') closeHandler = handler;
          },
        };

        const res = {
          writeHead: () => {},
          write: (chunk) => written.push(chunk),
          end: () => {},
          on: () => {},
        };

        await streamProjectProgress(req, res);

        // milestone_2 was replayed
        const occurrencesBefore = written.filter((c) => c.includes(`id: ${projectId}:2`)).length;
        assert.strictEqual(occurrencesBefore, 1);

        // Simulate duplicate emission of milestone_2 over the event bus
        const channel = `project:${projectId}`;
        const { projectEventBus } = await import('../services/projectEvents.js');
        projectEventBus.emit(channel, {
          id: `${projectId}:2`,
          seq: 2,
          event: 'milestone_2',
          data: { data: 'two' },
        });

        const occurrencesAfter = written.filter((c) => c.includes(`id: ${projectId}:2`)).length;
        assert.strictEqual(occurrencesAfter, 1, 'Duplicate event must be ignored by deduplication set');

        closeHandler?.();
      } finally {
        Project.findById = originalFindById;
      }
    });

    it('terminates stream cleanly when replayed events include terminal completed event', async () => {
      const projectId = '507f1f77bcf86cd799439013';
      const originalFindById = Project.findById;

      Project.findById = async () => ({
        _id: projectId,
        owner: 'user_term_test',
        status: 'completed',
        name: 'Finished App',
        version: 1,
      });

      try {
        emitProjectEvent(projectId, 'file_complete', { path: '/App.jsx' });
        emitProjectEvent(projectId, 'completed', { status: 'completed' });

        const written = [];
        let ended = false;

        const req = {
          user: { userID: 'user_term_test' },
          params: { id: projectId },
          headers: { 'last-event-id': `${projectId}:1` },
          on: () => {},
        };

        const res = {
          writeHead: () => {},
          write: (chunk) => written.push(chunk),
          end: () => {
            ended = true;
          },
          on: () => {},
        };

        await streamProjectProgress(req, res);

        assert.strictEqual(ended, true, 'Stream must end after replaying terminal event');
        assert.ok(written.some((c) => c.includes('event: completed\n')));
      } finally {
        Project.findById = originalFindById;
      }
    });

    it('handles evicted Last-Event-ID gracefully without throwing or sending corrupt state', async () => {
      const projectId = '507f1f77bcf86cd799439014';
      const originalFindById = Project.findById;

      Project.findById = async () => ({
        _id: projectId,
        owner: 'user_evict_test',
        status: 'generating',
        name: 'Evicted Recovery App',
        version: 1,
      });

      try {
        // Emit 70 events so events 1-20 are evicted
        for (let i = 1; i <= 70; i++) {
          emitProjectEvent(projectId, 'step', { count: i });
        }

        const written = [];
        let closeHandler = null;

        // Client reconnects with old evicted Last-Event-ID = 5
        const req = {
          user: { userID: 'user_evict_test' },
          params: { id: projectId },
          headers: { 'last-event-id': `${projectId}:5` },
          on: (event, handler) => {
            if (event === 'close') closeHandler = handler;
          },
        };

        const res = {
          writeHead: () => {},
          write: (chunk) => written.push(chunk),
          end: () => {},
          on: () => {},
        };

        await streamProjectProgress(req, res);

        // Ground-truth initial_state is sent
        assert.ok(written[0].startsWith('event: initial_state\n'));

        // No partial replay should occur since event 5 was evicted
        assert.strictEqual(written.length, 1);

        // Live stream should continue to function
        emitProjectEvent(projectId, 'step', { count: 71 });
        assert.ok(written.some((c) => c.includes(`id: ${projectId}:71`)));

        closeHandler?.();
      } finally {
        Project.findById = originalFindById;
      }
    });
  });

  describe('Task 4 (Live HTTP): Real HTTP Reconnection with Last-Event-ID', () => {
    it('reconnects over HTTP with Last-Event-ID, replays missed events, and cleans up completely', async () => {
      const projectId = '507f1f77bcf86cd799439015';
      const originalFindById = Project.findById;

      Project.findById = async () => ({
        _id: projectId,
        owner: 'user_live_http',
        status: 'generating',
        name: 'Live HTTP Replay App',
        version: 1,
      });

      const server = http.createServer((req, res) => {
        req.user = { userID: 'user_live_http' };
        req.params = { id: projectId };
        streamProjectProgress(req, res);
      });

      try {
        await new Promise((resolve, reject) => {
          server.listen(0, '127.0.0.1', resolve);
          server.on('error', reject);
        });
      } catch (err) {
        if (err.code === 'EPERM') {
          // Sandbox mode may disallow TCP binding; skip network socket test in sandbox
          return;
        }
        throw err;
      }

      const port = server.address().port;
      const baselineSubscribers = getProjectSubscriberCount(projectId);

      let isSandboxBlocked = false;

      try {
        // Step 1: Initial client connection
        const chunks1 = [];
        let clientReq1 = null;

        await new Promise((resolve, reject) => {
          clientReq1 = http.get(`http://127.0.0.1:${port}`, (res) => {
            res.on('data', (d) => {
              chunks1.push(d.toString());
              if (chunks1.join('').includes('initial_state')) {
                resolve();
              }
            });
          });
          clientReq1.on('error', (err) => {
            if (err.code === 'EPERM') {
              isSandboxBlocked = true;
              resolve();
            } else {
              reject(err);
            }
          });
        });

        if (isSandboxBlocked) {
          // In sandboxed OS environments where loopback socket connect is blocked, gracefully skip live HTTP roundtrip
          return;
        }

        // Step 2: Emit events 1 and 2
        emitProjectEvent(projectId, 'requirement_contract', { category: 'saas' });
        emitProjectEvent(projectId, 'design_spec', { theme: 'modern' });

        await new Promise((resolve) => setTimeout(resolve, 50));
        assert.ok(chunks1.some((c) => c.includes(`id: ${projectId}:1`)));
        assert.ok(chunks1.some((c) => c.includes(`id: ${projectId}:2`)));

        // Step 3: Disconnect client 1
        clientReq1.destroy();
        await new Promise((resolve) => setTimeout(resolve, 50));
        assert.strictEqual(getProjectSubscriberCount(projectId), baselineSubscribers);

        // Step 4: Emit events 3 and 4 while client is disconnected
        emitProjectEvent(projectId, 'plan', { steps: ['A', 'B'] });
        emitProjectEvent(projectId, 'file_start', { currentFile: '/src/Main.jsx' });

        // Step 5: Client 2 reconnects sending Last-Event-ID = `${projectId}:2`
        const chunks2 = [];
        let clientReq2 = null;

        await new Promise((resolve) => {
          const options = {
            hostname: '127.0.0.1',
            port,
            path: '/',
            headers: {
              'Last-Event-ID': `${projectId}:2`,
            },
          };

          clientReq2 = http.get(options, (res) => {
            res.on('data', (d) => {
              chunks2.push(d.toString());
              // Resolve once initial state and replayed events arrive
              if (chunks2.join('').includes(`id: ${projectId}:4`)) {
                resolve();
              }
            });
          });
        });

        const combinedOutput = chunks2.join('');
        // Must contain initial_state
        assert.ok(combinedOutput.includes('event: initial_state\n'));
        // Must NOT contain already received events 1 or 2
        assert.ok(!combinedOutput.includes(`id: ${projectId}:1`));
        assert.ok(!combinedOutput.includes(`id: ${projectId}:2`));
        // Must contain missed events 3 and 4
        assert.ok(combinedOutput.includes(`id: ${projectId}:3`));
        assert.ok(combinedOutput.includes('event: plan\n'));
        assert.ok(combinedOutput.includes(`id: ${projectId}:4`));
        assert.ok(combinedOutput.includes('event: file_start\n'));

        // Step 6: Emit live event 5 and verify client 2 receives it
        emitProjectEvent(projectId, 'file_complete', { path: '/src/Main.jsx' });
        await new Promise((resolve) => setTimeout(resolve, 50));
        assert.ok(chunks2.join('').includes(`id: ${projectId}:5`));

        // Step 7: Clean disconnect client 2
        clientReq2.destroy();
        await new Promise((resolve) => setTimeout(resolve, 50));
        assert.strictEqual(getProjectSubscriberCount(projectId), baselineSubscribers);
      } finally {
        Project.findById = originalFindById;
        await new Promise((resolve) => server.close(resolve));
      }
    });
  });
});
