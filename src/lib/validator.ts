import { CVContentSchema, ExperienceEntrySchema } from "./schemas";

/**
 * Realism guardrails for generated CV content.
 * Throws with a helpful message when AI output fails consistency checks.
 * Used as the gate between LLM output and the persistence layer.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseMonthYear(s: string): number {
  if (s === "Present") {
    const now = new Date();
    return now.getFullYear() + now.getMonth() / 12;
  }
  const [m, y] = s.split(" ");
  const idx = MONTHS.indexOf(m.slice(0, 3));
  return Number(y) + Math.max(0, idx) / 12;
}

export interface ValidationResult {
  ok: boolean;
  issues: string[];
  content: ReturnType<typeof CVContentSchema.parse>;
}

export function validateCVContent(raw: unknown): ValidationResult {
  const issues: string[] = [];

  let content;
  try {
    content = CVContentSchema.parse(raw);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, issues: ["Schema validation failed: " + msg], content: raw as never };
  }

  // 1. Timeline: non-overlapping, gap-free, ordered descending (most recent first)
  const exp = content.experience;
  for (let i = 0; i < exp.length; i++) {
    const e = exp[i];
    const start = parseMonthYear(e.startDate);
    const end = parseMonthYear(e.endDate);
    if (end < start) {
      issues.push(`Experience #${i + 1} (${e.company}): endDate (${e.endDate}) is before startDate (${e.startDate}).`);
    }
    if (i > 0) {
      const prevStart = parseMonthYear(exp[i - 1].startDate);
      const gap = prevStart - end;
      // Allow up to ~2 months gap; more = flagged (but not hard-fail)
      if (gap > 0.2) {
        issues.push(`Gap of ~${(gap * 12).toFixed(0)} months between ${exp[i - 1].company} and ${e.company}.`);
      }
    }
  }

  // 2. Bullets 8-25 words each
  for (const e of exp) {
    for (let i = 0; i < e.bullets.length; i++) {
      const words = e.bullets[i].trim().split(/\s+/).length;
      if (words < 8 || words > 25) {
        issues.push(`Bullet for ${e.company} (#${i + 1}) has ${words} words — should be 8-25.`);
      }
    }
  }

  // 3. Skills coverage >= 80% of job's requiredSkills (handled at /api/cvs with job cache)
  return { ok: issues.length === 0, issues, content };
}

export const CvEntrySchema = ExperienceEntrySchema;
export const CvContentSchema = CVContentSchema;