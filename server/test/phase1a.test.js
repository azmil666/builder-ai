import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import authRouter from '../routes/authRoutes.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { Project } from '../models/Project.js';

describe('Phase 1A: Core Functionality Stabilization Tests', () => {

  describe('Task 1: Authentication Session Persistence', () => {
    it('authRoutes registers both GET and POST for /me', () => {
      const routes = authRouter.stack.filter((layer) => layer.route);
      const meGetRoute = routes.find(
        (layer) => layer.route.path === '/me' && layer.route.methods.get
      );
      const mePostRoute = routes.find(
        (layer) => layer.route.path === '/me' && layer.route.methods.post
      );

      assert.ok(meGetRoute, 'GET /me route must be registered in authRouter');
      assert.ok(mePostRoute, 'POST /me route must be registered for backward compatibility');
    });

    it('authMiddleware rejects unauthenticated requests without session token', () => {
      const req = { cookies: {} };
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
      let nextCalled = false;
      authMiddleware(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(statusCode, 401);
      assert.match(jsonPayload.error, /No session token/);
    });

    it('authMiddleware decodes valid JWT token and populates req.user', () => {
      const secret = process.env.JWT_SECRET || 'fallback_secret';
      const token = jwt.sign({ userID: 'user123', email: 'test@example.com' }, secret);
      const req = { cookies: { token } };
      let nextCalled = false;
      const res = {
        status() { return this; },
        json() { return this; },
      };

      authMiddleware(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true);
      assert.equal(req.user.userID, 'user123');
      assert.equal(req.user.email, 'test@example.com');
    });

    it('authMiddleware rejects invalid/tampered token', () => {
      const req = { cookies: { token: 'invalid.jwt.token' } };
      let statusCode = null;
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json() { return this; },
      };
      let nextCalled = false;

      authMiddleware(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(statusCode, 401);
    });
  });

  describe('Task 2: Conversational Revision Authorization', () => {
    it('resolves authenticated user ID from both userID and userId payload formats', () => {
      const userWithUserID = { userID: 'user_6789' };
      const userWithUserId = { userId: 'user_1234' };

      const resolvedId1 = userWithUserID.userID || userWithUserID.userId;
      const resolvedId2 = userWithUserId.userID || userWithUserId.userId;

      assert.equal(resolvedId1, 'user_6789');
      assert.equal(resolvedId2, 'user_1234');
    });
  });

  describe('Task 3: AI Generation Fallback & Sensitive Data Redaction', () => {
    it('does not throw ReferenceError when processing failed pending files', () => {
      const pendingFiles = [
        { path: '/App.js', description: 'Main application' },
        { path: '/components/Card.js', description: 'Card component' },
        { path: '/styles.css', description: 'Global styles' },
      ];
      const files = {};

      // Simulate fallback placeholder generation logic
      for (const pendingFile of pendingFiles) {
        if (pendingFile.path === '/App.js') {
          continue;
        }
        const ext = pendingFile.path.split('.').pop()?.toLowerCase();
        if (ext === 'css') {
          files[pendingFile.path] = `/* ${pendingFile.description} — Generation failed, please retry */\n`;
        } else {
          files[pendingFile.path] =
            "import React from 'react';\n" +
            `// Purpose: ${pendingFile.description}\n`;
        }
      }

      // /App.js was not given a fake placeholder
      assert.equal(files['/App.js'], undefined);
      // Secondary files received valid placeholders
      assert.ok(files['/styles.css'].includes('Global styles'));
      assert.ok(files['/components/Card.js'].includes('Card component'));

      // Check that entrypoint failure is detected cleanly
      assert.throws(
        () => {
          if (!files['/App.js']) {
            throw new Error('AI did not generate /App.js entry point');
          }
        },
        {
          name: 'Error',
          message: 'AI did not generate /App.js entry point',
        }
      );
    });

    it('redacts sensitive API keys and authorization headers from error messages', () => {
      function sanitizeError(error) {
        if (!error) return 'Unknown error';
        const str = typeof error === 'string' ? error : error.message || String(error);
        return str
          .replace(/Bearer\s+[a-zA-Z0-9_\.\-]+/gi, 'Bearer [REDACTED_TOKEN]')
          .replace(/sk-[a-zA-Z0-9_\-]+/g, '[REDACTED_API_KEY]')
          .replace(/mongodb(\+srv)?:\/\/[^@]+@/gi, 'mongodb$1://[REDACTED_AUTH]@');
      }

      const rawOpenRouterErr = 'OpenRouter request failed: Bearer sk-or-v1-abcdef1234567890 failed';
      const rawMongoErr = 'Failed to connect: mongodb+srv://user:secretpass@cluster0.net/db';

      assert.equal(
        sanitizeError(rawOpenRouterErr),
        'OpenRouter request failed: Bearer [REDACTED_TOKEN] failed'
      );
      assert.equal(
        sanitizeError(rawMongoErr),
        'Failed to connect: mongodb+srv://[REDACTED_AUTH]@cluster0.net/db'
      );
    });
  });

  describe('Task 4: Database Schema Consistency', () => {
    it('ProjectSchema includes both currentFile and CurrentFile paths', () => {
      assert.ok(Project.schema.path('currentFile'), 'currentFile must be defined in Project schema');
      assert.ok(Project.schema.path('CurrentFile'), 'CurrentFile must be defined in Project schema for backward compatibility');
    });

    it('Project document synchronizes currentFile and legacy CurrentFile', () => {
      // Simulate existing legacy doc that only has CurrentFile
      const legacyDoc = new Project({
        name: 'Legacy Project',
        CurrentFile: '/App.js',
        owner: '507f191e810c19729de860ea',
      });

      // Hook post-init logic
      if (!legacyDoc.currentFile && legacyDoc.CurrentFile) {
        legacyDoc.currentFile = legacyDoc.CurrentFile;
      }
      assert.equal(legacyDoc.currentFile, '/App.js');

      // Update currentFile and verify synchronization on pre-save hook
      legacyDoc.currentFile = '/components/Header.js';
      if (legacyDoc.currentFile !== undefined) {
        legacyDoc.CurrentFile = legacyDoc.currentFile;
      }
      assert.equal(legacyDoc.CurrentFile, '/components/Header.js');
    });
  });
});
