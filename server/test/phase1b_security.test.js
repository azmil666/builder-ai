import 'dotenv/config';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { getJwtSecret } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
  createRateLimiter,
  authRateLimiter,
  aiGenerationRateLimiter,
  aiRevisionRateLimiter,
} from '../middleware/rateLimiter.js';
import {
  getProject,
  deleteProject,
  updateProjectFiles,
  publishProject,
  getPublicProject,
  sanitizeError,
} from '../controllers/projectController.js';
import { chat } from '../controllers/chatController.js';
import { Project } from '../models/Project.js';
import { applyOperations } from '../services/diff.js';

describe('Phase 1B: Security Hardening & Regression Suite', () => {

  describe('Task 1: JWT Secret Handling & Startup Safety', () => {
    it('getJwtSecret returns the configured JWT_SECRET when present', () => {
      const original = process.env.JWT_SECRET;
      process.env.JWT_SECRET = 'test_secret_12345';
      try {
        const secret = getJwtSecret();
        assert.equal(secret, 'test_secret_12345');
      } finally {
        process.env.JWT_SECRET = original;
      }
    });

    it('getJwtSecret throws when JWT_SECRET is unset or empty', () => {
      const original = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;
      try {
        assert.throws(
          () => getJwtSecret(),
          /JWT_SECRET is not configured/
        );
      } finally {
        process.env.JWT_SECRET = original;
      }
    });

    it('authMiddleware fails safely with HTTP 500 if JWT_SECRET is missing at runtime', () => {
      const original = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;
      let statusCode = null;
      let jsonPayload = null;
      const req = { cookies: { token: 'sample.jwt.token' } };
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          jsonPayload = data;
          return this;
        },
      };

      try {
        authMiddleware(req, res, () => {});
        assert.equal(statusCode, 500);
        assert.match(jsonPayload.error, /Authentication system is not properly configured/);
      } finally {
        process.env.JWT_SECRET = original;
      }
    });

    it('does not accept hardcoded fallback_secret when JWT_SECRET is set', () => {
      const forgedToken = jwt.sign({ userID: 'attacker' }, 'fallback_secret');
      const req = { cookies: { token: forgedToken } };
      let statusCode = null;
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json() { return this; },
      };

      authMiddleware(req, res, () => {});
      assert.equal(statusCode, 401, 'Forged token signed with fallback_secret must be rejected');
    });
  });

  describe('Task 2: Rate Limiting Enforcement', () => {
    it('rate limiter sets standard headers and blocks requests exceeding threshold', () => {
      const limiter = createRateLimiter({
        windowMs: 60 * 1000,
        max: 3,
        message: 'Rate limit exceeded',
        keyGenerator: () => 'test_ip',
      });

      const headers = {};
      let statusCode = 200;
      let jsonPayload = null;

      const createMock = () => ({
        req: {
          headers: { 'x-test-rate-limit': 'true' },
        },
        res: {
          setHeader(k, v) { headers[k] = v; },
          status(code) {
            statusCode = code;
            return this;
          },
          json(data) { jsonPayload = data; },
        },
      });

      // Request 1, 2, 3 should succeed
      for (let i = 1; i <= 3; i++) {
        let called = false;
        const { req, res } = createMock();
        limiter(req, res, () => { called = true; });
        assert.equal(called, true, `Request ${i} should be permitted`);
        assert.equal(headers['RateLimit-Limit'], 3);
        assert.equal(headers['RateLimit-Remaining'], 3 - i);
      }

      // Request 4 should be rejected with 429
      let calledOnBlock = false;
      const { req, res } = createMock();
      limiter(req, res, () => { calledOnBlock = true; });

      assert.equal(calledOnBlock, false, 'Request exceeding max limit must be blocked');
      assert.equal(statusCode, 429);
      assert.equal(jsonPayload.error, 'Rate limit exceeded');
      assert.ok(headers['Retry-After'] !== undefined, 'Retry-After header must be set');
    });

    it('authRateLimiter, aiGenerationRateLimiter, and aiRevisionRateLimiter are configured', () => {
      assert.equal(typeof authRateLimiter, 'function');
      assert.equal(typeof aiGenerationRateLimiter, 'function');
      assert.equal(typeof aiRevisionRateLimiter, 'function');
    });
  });

  describe('Task 3: Project Access Control & Ownership Enforcement', () => {
    it('rejects malformed MongoDB ObjectId with HTTP 404', async () => {
      const badId = 'invalid-mongo-id-123';
      let statusCode = null;
      let jsonPayload = null;

      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          jsonPayload = data;
          return this;
        },
      };

      // 1. getProject
      await getProject({ params: { id: badId }, user: { userID: '507f191e810c19729de860ea' } }, res);
      assert.equal(statusCode, 404);
      assert.equal(jsonPayload.error, 'Project not found');

      // 2. deleteProject
      await deleteProject({ params: { id: badId }, user: { userID: '507f191e810c19729de860ea' } }, res);
      assert.equal(statusCode, 404);

      // 3. updateProjectFiles
      await updateProjectFiles({ params: { id: badId }, body: { files: {} }, user: { userID: '507f191e810c19729de860ea' } }, res);
      assert.equal(statusCode, 404);

      // 4. publishProject
      await publishProject({ params: { id: badId }, user: { userID: '507f191e810c19729de860ea' } }, res);
      assert.equal(statusCode, 404);

      // 5. getPublicProject
      await getPublicProject({ params: { id: badId } }, res);
      assert.equal(statusCode, 404);

      // 6. chat
      await chat({ params: { id: badId }, body: { prompt: 'Add button' }, user: { userID: '507f191e810c19729de860ea' } }, res);
      assert.equal(statusCode, 404);
    });

    it('getPublicProject returns 403 when project is not published', async () => {
      const validId = '507f191e810c19729de860aa';
      let statusCode = null;
      let jsonPayload = null;

      const originalFindById = Project.findById;
      // Mock finding an unpublished project
      Project.findById = async () => ({
        _id: validId,
        name: 'Secret Project',
        published: false,
        files: {},
      });

      try {
        const res = {
          status(code) {
            statusCode = code;
            return this;
          },
          json(data) {
            jsonPayload = data;
            return this;
          },
        };

        await getPublicProject({ params: { id: validId } }, res);
        assert.equal(statusCode, 403);
        assert.equal(jsonPayload.error, 'Project is not published yet');
      } finally {
        Project.findById = originalFindById;
      }
    });

    it('getPublicProject returns 200 with public fields when project is published', async () => {
      const validId = '507f191e810c19729de860aa';
      let statusCode = 200;
      let jsonPayload = null;

      const originalFindById = Project.findById;
      Project.findById = async () => ({
        _id: validId,
        name: 'Public Showcase',
        description: 'Open to everyone',
        published: true,
        version: 1,
        files: {
          '/App.js': { content: 'export default () => <div>Hello</div>', hash: 'abc123' },
        },
      });

      try {
        const res = {
          status(code) {
            statusCode = code;
            return this;
          },
          json(data) {
            jsonPayload = data;
            return this;
          },
        };

        await getPublicProject({ params: { id: validId } }, res);
        assert.equal(statusCode, 200);
        assert.equal(jsonPayload.name, 'Public Showcase');
        assert.equal(jsonPayload.files['/App.js'], 'export default () => <div>Hello</div>');
        assert.equal(jsonPayload.messages, undefined, 'Private messages must not be exposed');
      } finally {
        Project.findById = originalFindById;
      }
    });

    it('enforces owner verification on private project queries', async () => {
      const targetId = '507f191e810c19729de860bb';
      const ownerId = '507f191e810c19729de86001';
      const nonOwnerId = '507f191e810c19729de86002';

      const originalFindOne = Project.findOne;
      Project.findOne = async (filter) => {
        // Only return project if owner matches
        if (filter.owner === ownerId && filter._id === targetId) {
          return {
            _id: targetId,
            name: 'User 1 Project',
            owner: ownerId,
            files: {},
            messages: [],
            version: 1,
          };
        }
        return null;
      };

      try {
        // Non-owner query
        let nonOwnerStatus = null;
        await getProject(
          { params: { id: targetId }, user: { userID: nonOwnerId } },
          {
            status(code) {
              nonOwnerStatus = code;
              return this;
            },
            json() { return this; },
          }
        );
        assert.equal(nonOwnerStatus, 404, 'Non-owner must receive 404');

        // Owner query
        let ownerStatus = 200;
        let ownerPayload = null;
        await getProject(
          { params: { id: targetId }, user: { userID: ownerId } },
          {
            status(code) {
              ownerStatus = code;
              return this;
            },
            json(data) {
              ownerPayload = data;
              return this;
            },
          }
        );
        assert.equal(ownerStatus, 200);
        assert.equal(ownerPayload._id, targetId);
      } finally {
        Project.findOne = originalFindOne;
      }
    });
  });

  describe('Task 4: Conversational Revisions & Diff Engine Regression', () => {
    it('applyOperations applies create, update, and delete diff operations correctly', () => {
      const initialFiles = {
        '/App.js': {
          content: 'export default function App() {\n  return <div>Old Content</div>;\n}',
          hash: 'hash1',
        },
        '/old-component.js': {
          content: 'export const Old = 1;',
          hash: 'hash2',
        },
      };

      const operations = [
        {
          op: 'create',
          path: '/components/Header.js',
          content: 'export function Header() { return <header>Header</header>; }',
        },
        {
          op: 'update',
          path: '/App.js',
          search: 'Old Content',
          replace: 'New Revised Content',
        },
        {
          op: 'delete',
          path: '/old-component.js',
        },
      ];

      const { files, applied, errors } = applyOperations(initialFiles, operations);

      assert.equal(errors.length, 0);
      assert.equal(applied.length, 3);
      assert.ok(files['/components/Header.js']);
      assert.equal(files['/old-component.js'], undefined);
      assert.ok(files['/App.js'].content.includes('New Revised Content'));
      assert.notEqual(files['/App.js'].hash, 'hash1');
    });

    it('applyOperations logs error cleanly when search block cannot be matched', () => {
      const initialFiles = {
        '/App.js': {
          content: 'export default function App() { return <div />; }',
          hash: 'hash1',
        },
      };

      const operations = [
        {
          op: 'update',
          path: '/App.js',
          search: 'NonExistentBlockToBeReplaced',
          replace: 'Replacement',
        },
      ];

      const { files, errors } = applyOperations(initialFiles, operations);
      assert.equal(errors.length, 1);
      assert.match(errors[0], /search string not found/);
      assert.equal(files['/App.js'].content, initialFiles['/App.js'].content);
    });
  });

  describe('Task 5: Sensitive Data Sanitization', () => {
    it('sanitizeError redacts Bearer tokens, OpenRouter API keys, and MongoDB auth', () => {
      const testCases = [
        {
          input: 'OpenRouter 401 error: Bearer sk-or-v1-abcdef1234567890 occurred',
          expected: 'OpenRouter 401 error: Bearer [REDACTED_TOKEN] occurred',
        },
        {
          input: 'Standalone key sk-abcdef0123456789 in log',
          expected: 'Standalone key [REDACTED_API_KEY] in log',
        },
        {
          input: 'Connection error to mongodb+srv://app_user:s3cr3tP%40ss@cluster0.net/prod',
          expected: 'Connection error to mongodb+srv://[REDACTED_AUTH]@cluster0.net/prod',
        },
      ];

      for (const { input, expected } of testCases) {
        assert.equal(sanitizeError(input), expected);
      }
    });
  });
});
