import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  isRedisEnabled,
  getRedisClient,
  createRedisSubscriber,
  closeRedisClients,
  setRedisClientOverride,
  resetRedisClientOverride,
} from '../config/redis.js';
import {
  emitProjectEvent,
  subscribeProjectEvents,
  getMissedProjectEvents,
  getMissedProjectEventsAsync,
  clearProjectReplayBuffer,
  closeRedisAdapters,
  initRedisPubSub,
  CURRENT_WORKER_ID,
  MAX_BUFFER_SIZE,
} from '../services/projectEvents.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';

/**
 * In-memory Mock Redis implementation supporting pipelines, sorted sets, lists,
 * and pub/sub fan-out between multiple simulated worker instances.
 */
class MockRedisSharedState {
  constructor() {
    this.strings = new Map();
    this.lists = new Map();
    this.zsets = new Map();
    this.subscribers = new Set(); // subscriber MockRedis instances
  }
}

class MockRedis {
  constructor(sharedState = null) {
    this.shared = sharedState || new MockRedisSharedState();
    this.eventListeners = new Map();
    this.subscribedChannels = new Set();
    this.status = 'ready';
    this.throwOnCommand = false;
  }

  on(event, handler) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event).add(handler);
    return this;
  }

  emit(event, ...args) {
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      for (const h of handlers) {
        h(...args);
      }
    }
  }

  async incr(key) {
    if (this.throwOnCommand) throw new Error('Redis connection timeout');
    const cur = parseInt(this.shared.strings.get(key) || '0', 10) + 1;
    this.shared.strings.set(key, cur.toString());
    return cur;
  }

  async rpush(key, ...values) {
    if (this.throwOnCommand) throw new Error('Redis connection timeout');
    let list = this.shared.lists.get(key);
    if (!list) {
      list = [];
      this.shared.lists.set(key, list);
    }
    list.push(...values);
    return list.length;
  }

  async ltrim(key, start, stop) {
    if (this.throwOnCommand) throw new Error('Redis connection timeout');
    let list = this.shared.lists.get(key) || [];
    const len = list.length;
    const s = start < 0 ? Math.max(0, len + start) : start;
    const e = stop < 0 ? len + stop + 1 : stop + 1;
    list = list.slice(s, e);
    this.shared.lists.set(key, list);
    return 'OK';
  }

  async lrange(key, start, stop) {
    if (this.throwOnCommand) throw new Error('Redis connection timeout');
    const list = this.shared.lists.get(key) || [];
    const len = list.length;
    const s = start < 0 ? Math.max(0, len + start) : start;
    const e = stop < 0 ? len + stop + 1 : (stop === -1 ? len : stop + 1);
    return list.slice(s, e);
  }

  async expire(_key, _seconds) {
    return 1;
  }

  async pexpire(_key, _ms) {
    return 1;
  }

  async zremrangebyscore(key, min, max) {
    if (this.throwOnCommand) throw new Error('Redis connection timeout');
    let set = this.shared.zsets.get(key) || [];
    const initial = set.length;
    set = set.filter((item) => item.score < min || item.score > max);
    this.shared.zsets.set(key, set);
    return initial - set.length;
  }

  async zadd(key, score, member) {
    if (this.throwOnCommand) throw new Error('Redis connection timeout');
    let set = this.shared.zsets.get(key);
    if (!set) {
      set = [];
      this.shared.zsets.set(key, set);
    }
    set = set.filter((item) => item.member !== member);
    set.push({ score, member });
    this.shared.zsets.set(key, set);
    return 1;
  }

  async zcard(key) {
    if (this.throwOnCommand) throw new Error('Redis connection timeout');
    const set = this.shared.zsets.get(key) || [];
    return set.length;
  }

  async publish(channel, message) {
    if (this.throwOnCommand) throw new Error('Redis connection timeout');
    let count = 0;
    for (const sub of this.shared.subscribers) {
      if (sub.subscribedChannels.has(channel)) {
        sub.emit('message', channel, message);
        count++;
      }
    }
    return count;
  }

  async subscribe(channel) {
    this.subscribedChannels.add(channel);
    this.shared.subscribers.add(this);
    return 1;
  }

  pipeline() {
    return this.multi();
  }

  multi() {
    const ops = [];
    const proxy = {
      incr: (key) => {
        ops.push(() => this.incr(key));
        return proxy;
      },
      rpush: (key, ...vals) => {
        ops.push(() => this.rpush(key, ...vals));
        return proxy;
      },
      ltrim: (key, s, e) => {
        ops.push(() => this.ltrim(key, s, e));
        return proxy;
      },
      expire: (key, sec) => {
        ops.push(() => this.expire(key, sec));
        return proxy;
      },
      pexpire: (key, ms) => {
        ops.push(() => this.pexpire(key, ms));
        return proxy;
      },
      publish: (channel, msg) => {
        ops.push(() => this.publish(channel, msg));
        return proxy;
      },
      zremrangebyscore: (key, min, max) => {
        ops.push(() => this.zremrangebyscore(key, min, max));
        return proxy;
      },
      zadd: (key, score, member) => {
        ops.push(() => this.zadd(key, score, member));
        return proxy;
      },
      zcard: (key) => {
        ops.push(() => this.zcard(key));
        return proxy;
      },
      exec: async () => {
        if (this.throwOnCommand) throw new Error('Redis connection timeout');
        const results = [];
        for (const op of ops) {
          try {
            const res = await op();
            results.push([null, res]);
          } catch (err) {
            results.push([err, null]);
          }
        }
        return results;
      },
    };
    return proxy;
  }

  async quit() {
    this.status = 'end';
    this.shared.subscribers.delete(this);
    return 'OK';
  }

  disconnect() {
    this.status = 'end';
    this.shared.subscribers.delete(this);
  }
}

describe('Phase 3B: Redis Multi-Instance Adapter & Sliding-Window Rate Limiter Suite', () => {
  const originalEnv = process.env.REDIS_URL;

  beforeEach(() => {
    delete process.env.REDIS_URL;
    resetRedisClientOverride();
    clearProjectReplayBuffer();
  });

  afterEach(async () => {
    process.env.REDIS_URL = originalEnv;
    await closeRedisAdapters();
    resetRedisClientOverride();
    clearProjectReplayBuffer();
  });

  describe('Task 1: In-Memory Fallback when REDIS_URL is Unset', () => {
    it('isRedisEnabled() returns false when REDIS_URL is unset', () => {
      delete process.env.REDIS_URL;
      assert.strictEqual(isRedisEnabled(), false);
      assert.strictEqual(getRedisClient(), null);
      assert.strictEqual(createRedisSubscriber(), null);
    });

    it('rate limiter falls back seamlessly to in-memory sliding window when Redis is unset', async () => {
      const limiter = createRateLimiter({
        windowMs: 60 * 1000,
        max: 2,
        message: 'Rate limit exceeded',
        keyGenerator: () => 'in_memory_user_1',
      });

      const responses = [];
      const createReqRes = () => {
        const headers = {};
        return {
          req: { headers: { 'x-test-rate-limit': 'true' } },
          res: {
            statusCode: 200,
            setHeader: (k, v) => {
              headers[k] = v;
            },
            status: function (c) {
              this.statusCode = c;
              return this;
            },
            json: function (payload) {
              responses.push({ statusCode: this.statusCode, payload, headers });
              return this;
            },
          },
        };
      };

      // 1st request -> Allowed
      let called1 = false;
      const m1 = createReqRes();
      await limiter(m1.req, m1.res, () => {
        called1 = true;
      });
      assert.strictEqual(called1, true);

      // 2nd request -> Allowed
      let called2 = false;
      const m2 = createReqRes();
      await limiter(m2.req, m2.res, () => {
        called2 = true;
      });
      assert.strictEqual(called2, true);

      // 3rd request -> Blocked with 429
      let called3 = false;
      const m3 = createReqRes();
      await limiter(m3.req, m3.res, () => {
        called3 = true;
      });
      assert.strictEqual(called3, false);
      assert.strictEqual(responses.length, 1);
      assert.strictEqual(responses[0].statusCode, 429);
      assert.strictEqual(responses[0].payload.error, 'Rate limit exceeded');
    });

    it('SSE event emission and missed event recovery operate in-memory when Redis is unset', async () => {
      const projectId = '507f1f77bcf86cd799439020';

      emitProjectEvent(projectId, 'file_start', { path: '/App.jsx' });
      emitProjectEvent(projectId, 'file_complete', { path: '/App.jsx' });

      // Synchronous recovery
      const missedSync = getMissedProjectEvents(projectId, `${projectId}:1`);
      assert.strictEqual(missedSync.length, 1);
      assert.strictEqual(missedSync[0].event, 'file_complete');

      // Asynchronous recovery
      const missedAsync = await getMissedProjectEventsAsync(projectId, `${projectId}:1`);
      assert.strictEqual(missedAsync.length, 1);
      assert.strictEqual(missedAsync[0].event, 'file_complete');
    });
  });

  describe('Task 2: Redis Client Initialization & Override Lifecycle', () => {
    it('initializes and closes mock Redis clients cleanly via lifecycle hooks', async () => {
      const shared = new MockRedisSharedState();
      const mockPrimary = new MockRedis(shared);
      const mockSubscriber = new MockRedis(shared);

      setRedisClientOverride({
        client: mockPrimary,
        subscriber: mockSubscriber,
        enabled: true,
      });

      assert.strictEqual(isRedisEnabled(), true);
      assert.strictEqual(getRedisClient(), mockPrimary);
      assert.strictEqual(createRedisSubscriber(), mockSubscriber);

      await closeRedisClients();
      assert.strictEqual(mockPrimary.status, 'end');
      assert.strictEqual(mockSubscriber.status, 'end');
    });
  });

  describe('Task 3: Multi-Instance Pub/Sub Fan-out & Origin Deduplication', () => {
    it('fans out published events across instances while originating worker ignores own emissions', async () => {
      const shared = new MockRedisSharedState();
      const workerA_client = new MockRedis(shared);
      const workerA_sub = new MockRedis(shared);

      setRedisClientOverride({
        client: workerA_client,
        subscriber: workerA_sub,
        enabled: true,
      });

      await initRedisPubSub();

      const projectId = '507f1f77bcf86cd799439021';
      const receivedOnLocalBus = [];

      const unsub = subscribeProjectEvents(projectId, (evt) => {
        receivedOnLocalBus.push(evt);
      });

      // 1. Worker A emits an event locally
      emitProjectEvent(projectId, 'plan', { name: 'App A' });

      // Worker A receives its own local emission once
      assert.strictEqual(receivedOnLocalBus.length, 1);
      assert.strictEqual(receivedOnLocalBus[0].event, 'plan');

      // Wait a tick for any Redis pub/sub delivery
      await new Promise((r) => setTimeout(r, 10));

      // Worker A must NOT have double-fired (origin worker deduplication)
      assert.strictEqual(receivedOnLocalBus.length, 1);

      // 2. Simulate Worker B publishing an event from another process
      const foreignEvent = {
        id: `${projectId}:2`,
        seq: 2,
        event: 'file_start',
        data: { currentFile: '/src/Index.jsx' },
        timestamp: new Date().toISOString(),
        _workerId: 'foreign-worker-uuid-999',
      };

      await workerA_sub.publish('builder:project-events', JSON.stringify(foreignEvent));

      // Worker A's subscriber must receive foreign event and forward to local bus
      assert.strictEqual(receivedOnLocalBus.length, 2);
      assert.strictEqual(receivedOnLocalBus[1].event, 'file_start');
      assert.strictEqual(receivedOnLocalBus[1].data.currentFile, '/src/Index.jsx');

      unsub();
    });
  });

  describe('Task 4: Distributed Replay Buffer & Sequence Counter', () => {
    it('pushes events to Redis replay list, updates cluster INCR, and retrieves missed events', async () => {
      const shared = new MockRedisSharedState();
      const mockClient = new MockRedis(shared);
      const mockSub = new MockRedis(shared);

      setRedisClientOverride({
        client: mockClient,
        subscriber: mockSub,
        enabled: true,
      });

      const projectId = '507f1f77bcf86cd799439022';

      // Emit 3 events
      emitProjectEvent(projectId, 'requirement_contract', { category: 'saas' });
      emitProjectEvent(projectId, 'design_spec', { theme: 'dark' });
      emitProjectEvent(projectId, 'plan', { steps: 5 });

      await new Promise((r) => setTimeout(r, 20));

      // Verify Redis list contains 3 entries
      const listKey = `builder:replay:${projectId}`;
      const inRedis = await mockClient.lrange(listKey, 0, -1);
      assert.strictEqual(inRedis.length, 3);

      // Verify sequence INCR was tracked
      const seqKey = `builder:seq:${projectId}`;
      assert.strictEqual(shared.strings.get(seqKey), '3');

      // Fetch missed events after Last-Event-ID = seq 1
      const missed = await getMissedProjectEventsAsync(projectId, `${projectId}:1`);
      assert.ok(Array.isArray(missed));
      assert.strictEqual(missed.length, 2);
      assert.strictEqual(missed[0].event, 'design_spec');
      assert.strictEqual(missed[1].event, 'plan');
    });

    it('bounds Redis replay list to MAX_BUFFER_SIZE (50) and handles evicted Last-Event-ID', async () => {
      const shared = new MockRedisSharedState();
      const mockClient = new MockRedis(shared);
      const mockSub = new MockRedis(shared);

      setRedisClientOverride({
        client: mockClient,
        subscriber: mockSub,
        enabled: true,
      });

      const projectId = '507f1f77bcf86cd799439023';

      // Emit 70 events
      for (let i = 1; i <= 70; i++) {
        emitProjectEvent(projectId, 'ping', { i });
      }

      await new Promise((r) => setTimeout(r, 20));

      const listKey = `builder:replay:${projectId}`;
      const inRedis = await mockClient.lrange(listKey, 0, -1);
      assert.strictEqual(inRedis.length, MAX_BUFFER_SIZE);

      // Sequence 5 is older than buffer (events 1-20 evicted) -> returns null
      const evicted = await getMissedProjectEventsAsync(projectId, `${projectId}:5`);
      assert.strictEqual(evicted, null);

      // Sequence 20 (oldestSeq - 1) returns all 50 buffered events
      const validReplay = await getMissedProjectEventsAsync(projectId, `${projectId}:20`);
      assert.ok(Array.isArray(validReplay));
      assert.strictEqual(validReplay.length, 50);
      assert.strictEqual(validReplay[0].seq, 21);
      assert.strictEqual(validReplay[49].seq, 70);
    });
  });

  describe('Task 5: Distributed Sliding-Window Rate Limiting & Fail-Open', () => {
    it('enforces shared rate limit across multiple workers using atomic ZSET pipeline', async () => {
      const shared = new MockRedisSharedState();
      const mockClient = new MockRedis(shared);

      setRedisClientOverride({
        client: mockClient,
        enabled: true,
      });

      const limiter = createRateLimiter({
        windowMs: 60 * 1000,
        max: 3,
        message: 'Shared rate limit reached',
        keyGenerator: () => 'shared_tenant_key',
      });

      const results = [];
      const makeReq = async () => {
        const headers = {};
        let passed = false;
        const req = { headers: { 'x-test-rate-limit': 'true' } };
        const res = {
          statusCode: 200,
          setHeader: (k, v) => {
            headers[k] = v;
          },
          status: function (c) {
            this.statusCode = c;
            return this;
          },
          json: function (p) {
            results.push({ statusCode: this.statusCode, payload: p, headers });
            return this;
          },
        };

        await limiter(req, res, () => {
          passed = true;
        });
        return { passed, headers };
      };

      // Requests 1, 2, 3 -> Passed
      const r1 = await makeReq();
      assert.strictEqual(r1.passed, true);
      assert.strictEqual(r1.headers['RateLimit-Remaining'], 2);

      const r2 = await makeReq();
      assert.strictEqual(r2.passed, true);
      assert.strictEqual(r2.headers['RateLimit-Remaining'], 1);

      const r3 = await makeReq();
      assert.strictEqual(r3.passed, true);
      assert.strictEqual(r3.headers['RateLimit-Remaining'], 0);

      // Request 4 -> Blocked with 429
      const r4 = await makeReq();
      assert.strictEqual(r4.passed, false);
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].statusCode, 429);
      assert.strictEqual(results[0].payload.error, 'Shared rate limit reached');
      assert.ok(results[0].headers['Retry-After'] !== undefined);
    });

    it('fails open when Redis encounters an error or timeout without blocking traffic', async () => {
      const shared = new MockRedisSharedState();
      const mockClient = new MockRedis(shared);
      mockClient.throwOnCommand = true; // Simulate Redis outage / timeout

      setRedisClientOverride({
        client: mockClient,
        enabled: true,
      });

      const limiter = createRateLimiter({
        windowMs: 60 * 1000,
        max: 2,
        keyGenerator: () => 'fail_open_key',
      });

      let nextCalled = false;
      const req = { headers: { 'x-test-rate-limit': 'true' } };
      const res = {
        statusCode: 200,
        setHeader: () => {},
        status: function (c) {
          this.statusCode = c;
          return this;
        },
        json: function () {
          return this;
        },
      };

      await limiter(req, res, () => {
        nextCalled = true;
      });

      // Must allow request through (fail open)
      assert.strictEqual(nextCalled, true);
      assert.strictEqual(res.statusCode, 200);
    });
  });
});

