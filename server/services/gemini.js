import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

let _clientInstance = null;

/**
 * Returns a cached or new GoogleGenAI client instance.
 * Throws early if GEMINI_API_KEY is not configured.
 */
export function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is missing.");
  }
  if (!_clientInstance) {
    _clientInstance = new GoogleGenAI({ apiKey });
  }
  return _clientInstance;
}

/**
 * Resets the client instance (useful for unit testing with mocked keys).
 */
export function resetGeminiClient() {
  _clientInstance = null;
}

/**
 * Sanitizes a Zod schema into a Gemini-compatible JSON Schema.
 * Strips $schema, additionalProperties, and other unsupported keywords.
 */
export function cleanJsonSchema(zodSchema) {
  if (!zodSchema) return null;
  const raw = z.toJSONSchema(zodSchema);
  const cloned = JSON.parse(JSON.stringify(raw));

  function sanitize(node) {
    if (!node || typeof node !== "object") return;
    delete node.$schema;
    delete node.additionalProperties;
    for (const key of Object.keys(node)) {
      if (typeof node[key] === "object" && node[key] !== null) {
        sanitize(node[key]);
      }
    }
  }

  sanitize(cloned);
  return cloned;
}

/**
 * Checks whether an error is transient (rate limit 429, high demand 503, unavailable).
 */
export function isTransientError(err) {
  if (!err) return false;
  const status = err.status || err.code || err.statusCode;
  if (status === 429 || status === 503) return true;

  const msg = (err.message || "").toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("503") ||
    msg.includes("resource_exhausted") ||
    msg.includes("unavailable") ||
    msg.includes("high demand") ||
    msg.includes("spikes in demand") ||
    msg.includes("temporarily unavailable")
  );
}

/**
 * Calculates adaptive retry delay: respects Google's recommended retry delay (e.g. "Please retry in 23s")
 * or falls back to exponential backoff with jitter.
 */
export function getRetryDelayMs(err, attempt) {
  const msg = err?.message || "";
  const match = msg.match(/retry\s+in\s+([0-9\.]+)\s*s/i);
  if (match) {
    const seconds = parseFloat(match[1]);
    if (!isNaN(seconds) && seconds > 0) {
      return Math.min(Math.ceil(seconds * 1000) + 500, 26000);
    }
  }
  return Math.min(Math.pow(2, attempt) * 1500 + Math.random() * 500, 15000);
}

/**
 * Extracts and cleans JSON text from a model response.
 * Strips potential markdown code blocks (```json ... ```).
 */
export function extractJsonFromText(rawText) {
  if (!rawText || typeof rawText !== "string") {
    throw new Error("Empty response text received from Gemini.");
  }

  let text = rawText.trim();

  // Strip markdown code fences if wrapped
  const fencePattern = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i;
  const fenceMatch = text.match(fencePattern);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  // If text has leading or trailing extra commentary, find outer braces
  if (!text.startsWith("{") && !text.startsWith("[")) {
    const startObj = text.indexOf("{");
    const startArr = text.indexOf("[");
    const start = (startObj !== -1 && (startArr === -1 || startObj < startArr)) ? startObj : startArr;
    if (start !== -1) {
      const endObj = text.lastIndexOf("}");
      const endArr = text.lastIndexOf("]");
      const end = Math.max(endObj, endArr);
      if (end > start) {
        text = text.slice(start, end + 1);
      }
    }
  }

  return text;
}

/**
 * Generates a structured object conforming to a Zod schema using Google Gemini API.
 * 
 * Signature matches Vercel AI SDK generateObject:
 * Returns: { object: <parsedAndValidatedData> }
 */
export async function generateGeminiObject({
  schema,
  system = "",
  prompt,
  maxRetries = 2,
  model = null,
}) {
  const client = getGeminiClient();

  const primaryModel = model || process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash-lite";

  const responseSchema = cleanJsonSchema(schema);

  const config = {
    responseMimeType: "application/json",
  };

  if (responseSchema) {
    config.responseSchema = responseSchema;
  }

  if (system && typeof system === "string" && system.trim().length > 0) {
    config.systemInstruction = system;
  }

  const modelsToAttempt = [primaryModel];
  if (fallbackModel && fallbackModel !== primaryModel) {
    modelsToAttempt.push(fallbackModel);
  }

  let lastError = null;

  for (const currentModel of modelsToAttempt) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await client.models.generateContent({
          model: currentModel,
          contents: prompt,
          config,
        });

        // 1. Inspect Candidate and Safety / Truncation Flags
        const candidate = response?.candidates?.[0];
        const finishReason = candidate?.finishReason;

        if (finishReason === "SAFETY") {
          throw new Error("Gemini blocked response generation due to content safety policy.");
        }

        if (finishReason === "MAX_TOKENS") {
          throw new Error("Gemini response was truncated due to MAX_TOKENS limit. Output is incomplete.");
        }

        const rawText = response?.text;
        if (!rawText || rawText.trim().length === 0) {
          throw new Error("Gemini returned an empty response.");
        }

        // 2. Parse JSON
        const cleanedText = extractJsonFromText(rawText);
        let parsed;
        try {
          parsed = JSON.parse(cleanedText);
        } catch (jsonErr) {
          throw new Error(`Failed to parse Gemini response as JSON: ${jsonErr.message}. Raw preview: ${cleanedText.slice(0, 120)}`);
        }

        // 3. Validate against Zod schema
        let validated;
        if (schema && typeof schema.parse === "function") {
          try {
            validated = schema.parse(parsed);
          } catch (zodErr) {
            throw new Error(`Gemini JSON does not conform to expected schema: ${zodErr.message}`);
          }
        } else {
          validated = parsed;
        }

        return { object: validated };
      } catch (err) {
        lastError = err;
        const transient = isTransientError(err);

        // If transient error and we still have attempts left on this model
        if (transient && attempt < maxRetries) {
          const delay = getRetryDelayMs(err, attempt);
          console.warn(`[Gemini] Transient error (${err.status || err.message}). Retrying ${currentModel} in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // If transient and retries exhausted on this model, allow outer loop to attempt fallback model
        if (transient && currentModel !== fallbackModel) {
          console.warn(`[Gemini] Model ${currentModel} exhausted transient retries. Attempting fallback model: ${fallbackModel}...`);
          break;
        }

        // For non-transient errors (e.g. invalid auth, schema failure, truncation), throw immediately
        if (!transient) {
          throw err;
        }
      }
    }
  }

  throw lastError || new Error("Gemini object generation failed after all retries and fallback models.");
}

/**
 * Generates raw text using Google Gemini API.
 */
export async function generateGeminiText({
  system = "",
  prompt,
  maxRetries = 2,
  model = null,
}) {
  const client = getGeminiClient();
  const currentModel = model || process.env.GEMINI_MODEL || "gemini-3.5-flash";

  const config = {};
  if (system && typeof system === "string" && system.trim().length > 0) {
    config.systemInstruction = system;
  }

  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.models.generateContent({
        model: currentModel,
        contents: prompt,
        config,
      });

      const candidate = response?.candidates?.[0];
      if (candidate?.finishReason === "SAFETY") {
        throw new Error("Gemini blocked response generation due to content safety policy.");
      }
      if (candidate?.finishReason === "MAX_TOKENS") {
        throw new Error("Gemini response was truncated due to MAX_TOKENS limit.");
      }

      return { text: response?.text || "" };
    } catch (err) {
      lastError = err;
      if (isTransientError(err) && attempt < maxRetries) {
        const delay = getRetryDelayMs(err, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}
