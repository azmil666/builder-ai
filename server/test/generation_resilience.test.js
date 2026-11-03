import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isTransientError,
  formatTransientError,
  getRetryDelayMs,
  generateGeminiObject,
  generateGeminiText,
  resetGeminiClient,
  getGeminiClient,
} from '../services/gemini.js';
import { FileCodeSchema } from '../services/aiSchemas.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Generation Resilience & Error Recovery Suite', () => {
  describe('Transient Error Classifier & Formatter', () => {
    it('correctly classifies HTTP 429, 503, quota, and capacity errors as transient', () => {
      assert.equal(isTransientError({ status: 429 }), true);
      assert.equal(isTransientError({ code: 429 }), true);
      assert.equal(isTransientError({ status: 503 }), true);
      assert.equal(isTransientError({ statusCode: 503 }), true);
      assert.equal(isTransientError(new Error('Resource has been exhausted (quota exceeded)')), true);
      assert.equal(isTransientError(new Error('Rate limit reached: too many requests')), true);
      assert.equal(isTransientError(new Error('The model is currently overloaded. Please try again.')), true);
      assert.equal(isTransientError(new Error('Service Unavailable: 503')), true);
    });

    it('formats rate limit 429 errors with actionable guidance', () => {
      const err = new Error('429 Resource has been exhausted (e.g. check quota)');
      err.status = 429;
      const formatted = formatTransientError(err);

      assert.equal(formatted.status, 429);
      assert.ok(formatted.message.includes('rate limit reached (429)'));
      assert.ok(formatted.message.includes('quota limit was exceeded'));
    });

    it('formats temporary capacity 503 errors with actionable guidance', () => {
      const err = new Error('The model is currently experiencing high demand.');
      err.status = 503;
      const formatted = formatTransientError(err);

      assert.equal(formatted.status, 503);
      assert.ok(formatted.message.includes('temporarily unavailable (503)'));
      assert.ok(formatted.message.includes('high demand'));
    });

    it('calculates adaptive retry delay with header recommendations', () => {
      const errWithWait = new Error('Quota exceeded. Please retry in 12s');
      const delay = getRetryDelayMs(errWithWait, 0);
      assert.ok(delay >= 12000 && delay <= 26000, `Expected delay around 12500ms, got ${delay}`);

      const errNormal = new Error('503 Service Unavailable');
      const normalDelay = getRetryDelayMs(errNormal, 1);
      assert.ok(normalDelay >= 2000 && normalDelay <= 15000);
    });
  });

  describe('Model Fallback and Retries on Exhaustion', () => {
    const originalApiKey = process.env.GEMINI_API_KEY;
    const originalModel = process.env.GEMINI_MODEL;
    const originalFallback = process.env.GEMINI_FALLBACK_MODEL;

    before(() => {
      process.env.GEMINI_API_KEY = 'AIzaFakeKeyForResilienceTesting012345';
      process.env.GEMINI_MODEL = 'gemini-primary-test';
      process.env.GEMINI_FALLBACK_MODEL = 'gemini-fallback-test';
    });

    after(() => {
      process.env.GEMINI_API_KEY = originalApiKey;
      process.env.GEMINI_MODEL = originalModel;
      process.env.GEMINI_FALLBACK_MODEL = originalFallback;
      resetGeminiClient();
    });

    it('generateGeminiObject falls back to secondary model when primary exhausts retries', async () => {
      resetGeminiClient();
      const client = getGeminiClient();

      const attemptedModels = [];
      client.models.generateContent = async ({ model }) => {
        attemptedModels.push(model);
        if (model === 'gemini-primary-test') {
          const err = new Error('429 Resource exhausted on primary');
          err.status = 429;
          throw err;
        }
        return {
          candidates: [{ finishReason: 'STOP' }],
          text: JSON.stringify({ code: 'export default function Recovered() { return <div>Recovered</div>; }' }),
        };
      };

      const result = await generateGeminiObject({
        schema: FileCodeSchema,
        prompt: 'Generate Recovered component',
        maxRetries: 0,
      });

      assert.ok(result.object.code.includes('Recovered'));
      assert.ok(attemptedModels.includes('gemini-primary-test'));
      assert.ok(attemptedModels.includes('gemini-fallback-test'));
    });

    it('generateGeminiText falls back to secondary model when primary exhausts retries', async () => {
      resetGeminiClient();
      const client = getGeminiClient();

      const attemptedModels = [];
      client.models.generateContent = async ({ model }) => {
        attemptedModels.push(model);
        if (model === 'gemini-primary-test') {
          const err = new Error('503 Spikes in demand');
          err.status = 503;
          throw err;
        }
        return {
          candidates: [{ finishReason: 'STOP' }],
          text: 'export default function TextRecovered() {}',
        };
      };

      const result = await generateGeminiText({
        prompt: 'Generate code snippet',
        maxRetries: 0,
      });

      assert.ok(result.text.includes('TextRecovered'));
      assert.ok(attemptedModels.includes('gemini-primary-test'));
      assert.ok(attemptedModels.includes('gemini-fallback-test'));
    });

    it('throws formatted rate limit error when all models and retries are exhausted', async () => {
      resetGeminiClient();
      const client = getGeminiClient();

      client.models.generateContent = async () => {
        const err = new Error('429 Rate limit quota exceeded');
        err.status = 429;
        throw err;
      };

      await assert.rejects(
        () =>
          generateGeminiObject({
            schema: FileCodeSchema,
            prompt: 'Generate component',
            maxRetries: 0,
          }),
        (err) => {
          assert.equal(err.status, 429);
          assert.ok(err.message.includes('rate limit reached (429)'));
          return true;
        }
      );
    });
  });

  describe('Nodemon Configuration Integrity', () => {
    it('verifies server/nodemon.json exists and ignores test, skills, and logs', () => {
      const nodemonPath = path.resolve(__dirname, '../nodemon.json');
      assert.ok(fs.existsSync(nodemonPath), 'server/nodemon.json must exist');

      const config = JSON.parse(fs.readFileSync(nodemonPath, 'utf-8'));
      assert.ok(Array.isArray(config.watch), 'nodemon.json must define watch directories');
      assert.ok(Array.isArray(config.ignore), 'nodemon.json must define ignore patterns');

      assert.ok(config.ignore.includes('test/**'), 'nodemon must ignore test directory to avoid generation restarts');
      assert.ok(config.ignore.includes('skills/**'), 'nodemon must ignore skills directory to avoid generation restarts');
      assert.ok(config.ignore.includes('*.log'), 'nodemon must ignore log files');
    });
  });
});

