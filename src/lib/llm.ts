import OpenAI from "openai";
import { z, ZodTypeAny } from "zod";
import { GoogleAuth } from "google-auth-library";

/**
 * LLM client for any OpenAI-compatible endpoint.
 *
 * Two providers (selected via LLM_PROVIDER):
 *  - "vertex": Google Vertex AI's OpenAI-compatible endpoint (Gemini). Auth is
 *    an OAuth access token minted from a service account (GOOGLE_APPLICATION_CREDENTIALS).
 *    No static key; the token is cached/refreshed by google-auth-library.
 *  - "openai": any OpenAI-compatible endpoint with a static API key. Defaults to
 *    NVIDIA (integrate.api.nvidia.com, nvidia/llama-3.3-nemotron-super-49b-v1);
 *    can be overridden via LLM_BASE_URL / LLM_MODEL. Supports a pool of API
 *    keys (LLM_API_KEYS comma-separated) with rotation on 429/403/5xx.
 *
 * Both modes use schema-in-prompt + Zod validation, retrying once on parse
 * failure with a stricter redo instruction. JSON-mode (response_format) is only
 * sent on endpoints that opt in (Gemini OpenAI Studio host); NVIDIA and Vertex
 * return plain text containing valid JSON.
 */

const PROVIDER = (process.env.LLM_PROVIDER ?? "openai").toLowerCase();
const IS_VERTEX = PROVIDER === "vertex";

const PROVIDES_JSON_MODE = !IS_VERTEX && /generativelanguage\.googleapis\.com/.test(process.env.LLM_BASE_URL ?? "");

export class LlmError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
  }
}

function getConfig(): { baseURL: string; model: string } {
  if (IS_VERTEX) {
    const project = process.env.GOOGLE_CLOUD_PROJECT;
    const location = process.env.VERTEX_LOCATION || "global";
    if (!project) throw new LlmError("GOOGLE_CLOUD_PROJECT not set for LLM_PROVIDER=vertex.");
    const host = location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
    return {
      baseURL: `https://${host}/v1beta1/projects/${project}/locations/${location}/endpoints/openapi`,
      model: process.env.LLM_MODEL || "google/gemini-2.5-flash-lite",
    };
  }
  return {
    baseURL: process.env.LLM_BASE_URL || process.env.GEMINI_BASE_URL || "https://integrate.api.nvidia.com/v1",
    model: process.env.LLM_MODEL || process.env.GEMINI_MODEL || "nvidia/llama-3.3-nemotron-super-49b-v1",
  };
}

function parseKeys(): string[] {
  const raw =
    process.env.LLM_API_KEYS ||
    process.env.GEMINI_API_KEYS ||
    process.env.GEMINI_API_KEY ||
    "";
  return raw.split(",").map((k) => k.trim()).filter(Boolean);
}

export const geminiKeys = parseKeys();

// Start at a random index so multiple instances don't all hammer key #1.
let keyIdx = Math.floor(Math.random() * Math.max(geminiKeys.length, 1));
function nextKey(): string | null {
  if (geminiKeys.length === 0) return null;
  const k = geminiKeys[keyIdx];
  keyIdx = (keyIdx + 1) % geminiKeys.length;
  return k;
}

export function isLlmConfigured(): boolean {
  if (IS_VERTEX) {
    return Boolean(process.env.GOOGLE_CLOUD_PROJECT && (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.VERTEX_CREDENTIALS_JSON));
  }
  return geminiKeys.length > 0;
}

// --- Vertex OAuth token (cached/refreshed by google-auth-library) ---
let vertexAuth: GoogleAuth | null = null;
async function getVertexToken(): Promise<string> {
  if (!vertexAuth) {
    if (process.env.VERTEX_CREDENTIALS_JSON) {
      vertexAuth = new GoogleAuth({ 
        credentials: JSON.parse(process.env.VERTEX_CREDENTIALS_JSON),
        scopes: ["https://www.googleapis.com/auth/cloud-platform"] 
      });
    } else {
      vertexAuth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
    }
  }
  const client = await vertexAuth.getClient();
  const res = await client.getAccessToken();
  const token = res.token;
  if (!token) throw new LlmError("Failed to obtain a Vertex AI access token from the service account.");
  return token;
}

function isRotatableError(e: unknown): boolean {
  const status = (e as { status?: number })?.status;
  if (status === 429 || status === 403) return true;
  if (status && status >= 500 && status < 600) return true;
  return false;
}

function schemaDescriptionJson(schema: ZodTypeAny): string {
  if (schema instanceof z.ZodObject) {
    const entries = Object.entries(schema.shape).map(([k, v]) => `${k}: ${schemaDescriptionJson(v as ZodTypeAny)}`);
    return `{\n  ${entries.join(",\n  ")}\n}`;
  }
  if (schema instanceof z.ZodArray) return `${schemaDescriptionJson(schema.element)}[]`;
  if (schema instanceof z.ZodString) return "string";
  if (schema instanceof z.ZodNumber) return "number";
  if (schema instanceof z.ZodBoolean) return "boolean";
  if (schema instanceof z.ZodEnum) return schema.options.map((o: string) => `"${String(o)}"`).join(" | ");
  if (schema instanceof z.ZodNullable) return `${schemaDescriptionJson(schema.unwrap())} | null`;
  if (schema instanceof z.ZodOptional) return `${schemaDescriptionJson(schema.unwrap())}?`;
  if (schema instanceof z.ZodDefault) return schemaDescriptionJson(schema.removeDefault());
  if (schema instanceof z.ZodUnion) return schema.options.map((o: ZodTypeAny) => schemaDescriptionJson(o)).join(" | ");
  if (schema instanceof z.ZodEffects) return schemaDescriptionJson(schema.innerType());
  return "any";
}

/**
 * Send a JSON completion to the configured LLM and parse with a Zod schema.
 * The schema is embedded in the system prompt. One retry on parse failure with
 * a stricter redo instruction. For the "openai" provider, 429/403/5xx rotates
 * to the next key in the pool.
 */
export async function llmJson<T extends ZodTypeAny>(
  schema: T,
  systemPrompt: string,
  userPrompt: string,
  opts?: { temperature?: number; maxTokens?: number },
): Promise<z.infer<T>> {
  if (!isLlmConfigured()) {
    throw new LlmError(
      "LLM not configured. Set LLM_PROVIDER=vertex with GOOGLE_CLOUD_PROJECT + GOOGLE_APPLICATION_CREDENTIALS, or set LLM_API_KEYS.",
    );
  }

  const { baseURL, model } = getConfig();
  const schemaJson = schemaDescriptionJson(schema);
  const fullSystem = `${systemPrompt}\n\nReturn ONLY a single valid JSON object (no markdown, no prose). The object MUST conform to this TypeScript-like shape:\n\`\`\`\n${schemaJson}\n\`\`\``;

  const callOnce = async (apiKey: string, extra: string) => {
    const client = new OpenAI({ apiKey, baseURL, maxRetries: 0 });
    const res = await client.chat.completions.create({
      model,
      temperature: opts?.temperature ?? 0.7,
      max_tokens: opts?.maxTokens ?? 2000,
      ...(PROVIDES_JSON_MODE ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: fullSystem + (extra ? `\n\n${extra}` : "") },
        { role: "user", content: userPrompt },
      ],
    });
    const choice = res.choices[0];
    const finishReason = choice?.finish_reason ?? "(none)";
    let raw = choice?.message?.content ?? "";
    if (process.env.ABCV_LLM_DEBUG === "1") {
      console.warn(`[llm] provider=${PROVIDER} model=${model} finish=${finishReason} usage=${JSON.stringify(res.usage)} rawLen=${raw.length}`);
    }
    if (finishReason === "length") {
      throw new LlmError(
        `LLM stopped at max_tokens (${res.usage?.completion_tokens}/${opts?.maxTokens ?? 2000}) — output truncated. Bump maxTokens or trim the prompt.`,
      );
    }
    if (!raw.trim()) {
      throw new LlmError(`LLM returned empty content (finish=${finishReason}).`);
    }
    // NVIDIA / Vertex / plain-text providers sometimes wrap the JSON in ```json fences.
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) raw = fence[1];
    try {
      return JSON.parse(raw);
    } catch (e) {
      throw new LlmError(`LLM returned non-JSON output: ${raw.slice(0, 200)}`, e);
    }
  };

  const retryHint = (e: unknown) =>
    e instanceof z.ZodError
      ? `Your previous reply failed validation with: ${JSON.stringify(e.issues.map((i) => i.message))}. Fix exactly these problems and return the corrected JSON only.`
      : `Your previous reply could not be parsed as JSON. Return only a raw JSON object.`;

  const isParseFailure = (e: unknown) => e instanceof z.ZodError || e instanceof LlmError;

  // --- Vertex: single token, retry once on parse failure or transient error ---
  if (IS_VERTEX) {
    const token = await getVertexToken();
    try {
      return schema.parse(await callOnce(token, ""));
    } catch (firstErr) {
      if (!isParseFailure(firstErr) && !isRotatableError(firstErr)) throw firstErr;
      // Token might have expired mid-flight — refresh before retrying.
      const fresh = isRotatableError(firstErr) ? await getVertexToken() : token;
      return schema.parse(await callOnce(fresh, retryHint(firstErr)));
    }
  }

  // --- OpenAI/NVIDIA: key pool with rotation on 429/403/5xx ---
  let lastErr: unknown;
  for (let attempt = 0; attempt < geminiKeys.length; attempt++) {
    const key = nextKey();
    if (!key) break;
    try {
      try {
        return schema.parse(await callOnce(key, ""));
      } catch (firstErr) {
        if (!isRotatableError(firstErr) && !(firstErr instanceof z.ZodError)) throw firstErr;
        return schema.parse(await callOnce(key, retryHint(firstErr)));
      }
    } catch (e) {
      lastErr = e;
      if (isRotatableError(e)) {
        console.warn(`[llm] key #${attempt} failed (${(e as { status?: number }).status}), rotating...`);
        continue;
      }
      throw e;
    }
  }
  throw new LlmError(`All ${geminiKeys.length} LLM keys exhausted.`, lastErr);
}
