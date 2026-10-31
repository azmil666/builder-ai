import 'dotenv/config';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import {
  getGeminiClient,
  resetGeminiClient,
  cleanJsonSchema,
  isTransientError,
  extractJsonFromText,
  generateGeminiObject,
  generateGeminiText,
} from '../services/gemini.js';
import { getActiveAiProvider, generateStructuredObject } from '../services/ai.js';
import {
  FileCodeSchema,
  FilePlanSchema,
  DesignSpecSchema,
  RevisionResultSchema,
} from '../services/aiSchemas.js';
import { sanitizeError } from '../controllers/projectController.js';

describe('Gemini API Provider & Integration Suite', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetGeminiClient();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetGeminiClient();
  });

  // 1. Client initialization and key requirements
  describe('Client Setup & Configuration', () => {
    it('initializes GoogleGenAI client when GEMINI_API_KEY is present', () => {
      process.env.GEMINI_API_KEY = 'AIzaSyFakeKeyForTesting123456789012';
      const client = getGeminiClient();
      assert.ok(client, 'Client instance should be created');
      assert.ok(client.models, 'Client should expose models namespace');
    });

    it('throws descriptive error when GEMINI_API_KEY is unset', () => {
      delete process.env.GEMINI_API_KEY;
      assert.throws(
        () => getGeminiClient(),
        /GEMINI_API_KEY environment variable is missing/,
        'Must throw missing key error'
      );
    });

    it('identifies active provider based on AI_PROVIDER and GEMINI_API_KEY', () => {
      process.env.AI_PROVIDER = 'gemini';
      assert.equal(getActiveAiProvider(), 'gemini');

      process.env.AI_PROVIDER = 'openrouter';
      assert.equal(getActiveAiProvider(), 'openrouter');

      delete process.env.AI_PROVIDER;
      process.env.GEMINI_API_KEY = 'AIzaSyFakeKeyForTesting123456789012';
      assert.equal(getActiveAiProvider(), 'gemini');

      delete process.env.GEMINI_API_KEY;
      assert.equal(getActiveAiProvider(), 'openrouter');
    });
  });

  // 2. Schema Cleaning & Compatibility
  describe('Schema Sanitization (cleanJsonSchema)', () => {
    it('strips $schema and additionalProperties from schema nodes', () => {
      const SimpleSchema = z.object({
        name: z.string(),
        items: z.array(z.object({ id: z.number() })),
      });

      const cleaned = cleanJsonSchema(SimpleSchema);
      assert.equal(cleaned.$schema, undefined, 'Must remove top-level $schema');
      assert.equal(cleaned.additionalProperties, undefined, 'Must remove additionalProperties');
      assert.equal(cleaned.properties.name.type, 'string');
      assert.equal(cleaned.properties.items.type, 'array');
      assert.equal(cleaned.properties.items.items.additionalProperties, undefined);
    });

    it('successfully sanitizes all Builder AI core schemas', () => {
      const schemas = [
        { name: 'FileCodeSchema', schema: FileCodeSchema },
        { name: 'FilePlanSchema', schema: FilePlanSchema },
        { name: 'DesignSpecSchema', schema: DesignSpecSchema },
        { name: 'RevisionResultSchema', schema: RevisionResultSchema },
      ];

      for (const { name, schema } of schemas) {
        const cleaned = cleanJsonSchema(schema);
        assert.ok(cleaned, `${name} should sanitize to non-null schema`);
        assert.equal(cleaned.$schema, undefined, `${name} must not contain $schema`);
        assert.equal(cleaned.type, 'object', `${name} must have object root type`);
      }
    });
  });

  // 3. Transient Error Detection
  describe('Transient Error Classifier (isTransientError)', () => {
    it('identifies 429 and 503 HTTP status errors as transient', () => {
      assert.equal(isTransientError({ status: 429 }), true);
      assert.equal(isTransientError({ status: 503 }), true);
      assert.equal(isTransientError({ statusCode: 503 }), true);
      assert.equal(isTransientError({ code: 429 }), true);
    });

    it('identifies demand spike and resource exhausted messages as transient', () => {
      assert.equal(isTransientError(new Error('This model is currently experiencing high demand.')), true);
      assert.equal(isTransientError(new Error('RESOURCE_EXHAUSTED: quota exceeded')), true);
      assert.equal(isTransientError(new Error('503 Service Unavailable')), true);
      assert.equal(isTransientError(new Error('Spikes in demand are usually temporary')), true);
    });

    it('flags non-transient errors as non-retryable', () => {
      assert.equal(isTransientError({ status: 400 }), false);
      assert.equal(isTransientError({ status: 401 }), false);
      assert.equal(isTransientError(new Error('Invalid API key provided')), false);
      assert.equal(isTransientError(new Error('Schema validation error')), false);
    });
  });

  // 4. Robust JSON Extraction
  describe('JSON Extraction (extractJsonFromText)', () => {
    it('extracts raw JSON string without alteration', () => {
      const json = '{"code":"export default function App() {}"}';
      assert.equal(extractJsonFromText(json), json);
    });

    it('strips markdown code blocks (```json ... ```)', () => {
      const wrapped = '```json\n{\n  "code": "test"\n}\n```';
      const extracted = extractJsonFromText(wrapped);
      assert.equal(JSON.parse(extracted).code, 'test');
    });

    it('extracts embedded JSON when preceded by commentary', () => {
      const messy = 'Here is the generated output you requested:\n{"code":"const a = 1;"}\nHope this helps!';
      const extracted = extractJsonFromText(messy);
      assert.equal(JSON.parse(extracted).code, 'const a = 1;');
    });

    it('throws error when response text is empty or non-string', () => {
      assert.throws(() => extractJsonFromText(''), /Empty response text/);
      assert.throws(() => extractJsonFromText(null), /Empty response text/);
    });
  });

  // 5. Truncation and Safety Detection
  describe('Finish Reason & Safety Handling', () => {
    it('throws descriptive error on finishReason MAX_TOKENS', async () => {
      process.env.GEMINI_API_KEY = 'AIzaSyFakeKeyForTesting123456789012';
      const client = getGeminiClient();

      // Mock generateContent with truncated candidate
      client.models.generateContent = async () => ({
        candidates: [{ finishReason: 'MAX_TOKENS' }],
        text: '{"code": "import React from \'react\'; const App = () => {',
      });

      await assert.rejects(
        () => generateGeminiObject({
          schema: FileCodeSchema,
          prompt: 'Write code',
          maxRetries: 0,
        }),
        /MAX_TOKENS limit/
      );
    });

    it('throws safety error on finishReason SAFETY', async () => {
      process.env.GEMINI_API_KEY = 'AIzaSyFakeKeyForTesting123456789012';
      const client = getGeminiClient();

      client.models.generateContent = async () => ({
        candidates: [{ finishReason: 'SAFETY' }],
        text: '',
      });

      await assert.rejects(
        () => generateGeminiObject({
          schema: FileCodeSchema,
          prompt: 'Write code',
          maxRetries: 0,
        }),
        /safety policy/
      );
    });
  });

  // 6. Schema Validation & Retry Behavior
  describe('Structured Object Generation & Validation', () => {
    it('successfully parses and validates against Zod schema', async () => {
      process.env.GEMINI_API_KEY = 'AIzaSyFakeKeyForTesting123456789012';
      const client = getGeminiClient();

      client.models.generateContent = async () => ({
        candidates: [{ finishReason: 'STOP' }],
        text: JSON.stringify({ code: 'export default function App() { return <div>App</div>; }' }),
      });

      const { object } = await generateGeminiObject({
        schema: FileCodeSchema,
        prompt: 'Generate App',
        maxRetries: 0,
      });

      assert.ok(object.code.includes('App'));
    });

    it('throws validation error when returned JSON violates schema', async () => {
      process.env.GEMINI_API_KEY = 'AIzaSyFakeKeyForTesting123456789012';
      const client = getGeminiClient();

      client.models.generateContent = async () => ({
        candidates: [{ finishReason: 'STOP' }],
        text: JSON.stringify({ wrongField: 'missing code' }),
      });

      await assert.rejects(
        () => generateGeminiObject({
          schema: FileCodeSchema,
          prompt: 'Generate App',
          maxRetries: 0,
        }),
        /does not conform to expected schema/
      );
    });

    it('recovers from transient error on second attempt', async () => {
      process.env.GEMINI_API_KEY = 'AIzaSyFakeKeyForTesting123456789012';
      const client = getGeminiClient();

      let calls = 0;
      client.models.generateContent = async () => {
        calls++;
        if (calls === 1) {
          const err = new Error('This model is currently experiencing high demand.');
          err.status = 503;
          throw err;
        }
        return {
          candidates: [{ finishReason: 'STOP' }],
          text: JSON.stringify({ code: 'export const Button = () => <button>Click</button>;' }),
        };
      };

      const { object } = await generateGeminiObject({
        schema: FileCodeSchema,
        prompt: 'Generate Button',
        maxRetries: 2,
      });

      assert.equal(calls, 2, 'Should succeed on attempt 2 after transient 503');
      assert.ok(object.code.includes('Button'));
    });
  });

  // 7. Security Redaction for Gemini Keys
  describe('Security & Sensitive Data Redaction', () => {
    it('redacts Google Gemini API keys (AIza...) in error messages', () => {
      const rawError = 'Error connecting with key AIzaSyA1234567890abcdefghijklmnopqrstuv and sk-openrouter123456789';
      const sanitized = sanitizeError(rawError);

      assert.equal(sanitized.includes('AIzaSyA1234567890abcdefghijklmnopqrstuv'), false);
      assert.ok(sanitized.includes('[REDACTED_GEMINI_KEY]'));
      assert.equal(sanitized.includes('sk-openrouter123456789'), false);
      assert.ok(sanitized.includes('[REDACTED_API_KEY]'));
    });
  });
});

