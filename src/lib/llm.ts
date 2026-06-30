import OpenAI from "openai";
import { z, ZodTypeAny } from "zod";

/**
 * LLM client for OpenCode Go models.
 * Currently configured to Kimi K2.6 via the OpenCode Go OpenAI-compatible
 * endpoint (/v1/chat/completions). Switch model via OPENCODE_GO_MODEL env var.
 * Uses JSON-mode + schema-in-prompt + Zod validation, retrying once on failure.
 */

const apiKey = process.env.OPENCODE_GO_API_KEY;
const baseURL = process.env.OPENCODE_GO_BASE_URL ?? "https://opencode.ai/zen/go/v1";
const model = process.env.OPENCODE_GO_MODEL ?? "deepseek-v4-flash";

export const llm = apiKey
  ? new OpenAI({ apiKey, baseURL })
  : null;

export const isLlmConfigured = () => Boolean(apiKey);

export class LlmError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
  }
}

/**
 * Send a JSON-mode completion to the configured LLM and parse with a Zod schema.
 * The schema is embedded in the system prompt as JSON; one retry on parse failure
 * with a stricter redo instruction.
 */
export async function llmJson<T extends ZodTypeAny>(
  schema: T,
  systemPrompt: string,
  userPrompt: string,
  opts?: { temperature?: number; maxTokens?: number },
): Promise<z.infer<T>> {
  if (!llm) throw new LlmError("OPENCODE_GO_API_KEY not set — cannot call LLM.");

  const schemaJson = schemaDescriptionJson(schema);
  const fullSystem = `${systemPrompt}\n\nReturn ONLY a single valid JSON object (no markdown, no prose). The object MUST conform to this TypeScript-like shape:\n\`\`\`\n${schemaJson}\n\`\`\``;

  const callOnce = async (extra: string) => {
    const res = await llm.chat.completions.create({
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
      throw new LlmError(`LLM stopped at max_tokens (${res.usage?.completion_tokens}/${opts?.maxTokens ?? 2000}) — output truncated. Bump maxTokens or trim the prompt.`);
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

  let parsed: unknown;
  try {
    parsed = await callOnce("");
    return schema.parse(parsed);
  } catch (firstErr) {
    const retryHint =
      firstErr instanceof z.ZodError
        ? `Your previous reply failed validation with: ${JSON.stringify(
            firstErr.issues.map((i) => i.message),
          )}. Fix exactly these problems and return the corrected JSON only.`
        : `Your previous reply could not be parsed as JSON. Return only a raw JSON object.`;
    parsed = await callOnce(retryHint);
    return schema.parse(parsed);
  }
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
  return "any";
}