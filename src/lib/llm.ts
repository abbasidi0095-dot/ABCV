import OpenAI from "openai";
import { z, ZodTypeAny } from "zod";

/**
 * LLM client for Google Gemini models via OpenAI-compatible endpoint.
 * Supports a pool of API keys (GEMINI_API_KEYS comma-separated) with automatic
 * rotation on 429/403/5xx. Falls back to a single GEMINI_API_KEY for back-compat.
 * Uses JSON-mode + schema-in-prompt + Zod validation, retrying once per key on
 * parse failure with a stricter redo instruction.
 */

const baseURL = process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai/";
const model = process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";

function parseKeys(): string[] {
  const raw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
  return raw
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
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

export const isLlmConfigured = () => geminiKeys.length > 0;

export class LlmError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
  }
}

/** Return true if we should rotate to the next API key for this error. */
function isRotatableError(e: unknown): boolean {
  const status = (e as { status?: number })?.status;
  if (status === 429) return true; // rate limited
  if (status === 403) return true; // quota / key disabled
  if (status && status >= 500 && status < 600) return true; // transient server error
  return false;
}

/**
 * Send a JSON-mode completion to the configured LLM and parse with a Zod schema.
 * The schema is embedded in the system prompt as JSON. One retry per key on parse
 * failure with a stricter redo instruction. If a key returns 429/403/5xx, the
 * next key in the pool is tried automatically.
 */
export async function llmJson<T extends ZodTypeAny>(
  schema: T,
  systemPrompt: string,
  userPrompt: string,
  opts?: { temperature?: number; maxTokens?: number },
): Promise<z.infer<T>> {
  if (!isLlmConfigured()) throw new LlmError("GEMINI_API_KEY(S) not set — cannot call LLM.");

  const schemaJson = schemaDescriptionJson(schema);
  const fullSystem = `${systemPrompt}\n\nReturn ONLY a single valid JSON object (no markdown, no prose). The object MUST conform to this TypeScript-like shape:\n\`\`\`\n${schemaJson}\n\`\`\``;

  const callOnce = async (client: OpenAI, extra: string) => {
    const res = await client.chat.completions.create({
      model,
      temperature: opts?.temperature ?? 0.7,
      max_tokens: opts?.maxTokens ?? 2000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: fullSystem + (extra ? `\n\n${extra}` : "") },
        { role: "user", content: userPrompt },
      ],
    });
    const choice = res.choices[0];
    const finishReason = choice?.finish_reason ?? "(none)";
    const raw = choice?.message?.content ?? "";
    if (process.env.ABCV_LLM_DEBUG === "1") {
      console.warn(`[llm] finish=${finishReason} usage=${JSON.stringify(res.usage)} rawLen=${raw.length}`);
    }
    if (finishReason === "length") {
      throw new LlmError(
        `LLM stopped at max_tokens (${res.usage?.completion_tokens}/${opts?.maxTokens ?? 2000}) — output truncated. Bump maxTokens or trim the prompt.`,
      );
    }
    if (!raw.trim()) {
      throw new LlmError(`LLM returned empty content (finish=${finishReason}).`);
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      throw new LlmError(`LLM returned non-JSON output: ${raw.slice(0, 200)}`, e);
    }
  };

  let lastErr: unknown;

  for (let attempt = 0; attempt < geminiKeys.length; attempt++) {
    const key = nextKey();
    if (!key) break;

    // Create a fresh client per key so retries don't get stuck on one bad key.
    const client = new OpenAI({ apiKey: key, baseURL, maxRetries: 0 });

    try {
      let parsed: unknown;
      try {
        parsed = await callOnce(client, "");
        return schema.parse(parsed);
      } catch (firstErr) {
        // Non-rotatable errors bubble immediately (bad request, auth, truncation, etc.).
        if (!isRotatableError(firstErr) && !(firstErr instanceof z.ZodError)) {
          throw firstErr;
        }

        const retryHint =
          firstErr instanceof z.ZodError
            ? `Your previous reply failed validation with: ${JSON.stringify(
                firstErr.issues.map((i) => i.message),
              )}. Fix exactly these problems and return the corrected JSON only.`
            : `Your previous reply could not be parsed as JSON. Return only a raw JSON object.`;

        parsed = await callOnce(client, retryHint);
        return schema.parse(parsed);
      }
    } catch (e) {
      lastErr = e;
      if (isRotatableError(e)) {
        console.warn(`[llm] key #${attempt} failed (${(e as { status?: number }).status}), rotating...`);
        continue;
      }
      // Any other error should not be retried across keys.
      throw e;
    }
  }

  throw new LlmError(`All ${geminiKeys.length} LLM keys exhausted.`, lastErr);
}

/** Best-effort human description of a Zod schema for LLM prompting. */
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
