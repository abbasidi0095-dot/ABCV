import { z } from "zod";

/** Parsed job — output of /api/jobs after scraping + LLM extraction */
export const JobParsedSchema = z.object({
  jobTitle: z.string().min(1),
  company: z.string().nullable().default(null),
  location: z.string().nullable().default(null),
  requiredSkills: z.array(z.string()).default([]),
  responsibilities: z.array(z.string()).default([]),
  yearsExperience: z.number().nullable().default(null),
  keywords: z.array(z.string()).default([]),
});
export type JobParsed = z.infer<typeof JobParsedSchema>;

const MONTH_PATTERN = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i;

/** Normalise a date string to short-month format (e.g. "Mar 2021"). */
export function normaliseDate(s: string): string {
  const t = s.trim();
  if (t.toLowerCase() === "present") return "Present";
  const m = t.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (!m) return t;
  const [, month, year] = m;
  const short = month.slice(0, 3);
  return short.charAt(0).toUpperCase() + short.slice(1).toLowerCase() + " " + year;
}

/** One generated work-experience entry */
export const ExperienceEntrySchema = z.object({
  company: z.string().min(1),
  title: z.string().min(1),
  startDate: z.string().regex(/^[A-Za-z]+\s+\d{4}$/).transform(normaliseDate),
  endDate: z.string().regex(/^[A-Za-z]+\s+\d{4}$|^Present$/i).transform(normaliseDate),
  bullets: z.array(z.string().min(1)).min(1).max(6),
});

/** AI-generated CV content (lives in Cv.contentJson). User-supplied
 *  fullName/email/phone/photo live on the Cv row itself. */
export const CVContentSchema = z.object({
  summary: z.string().min(20).max(400),
  experience: z.array(ExperienceEntrySchema).min(1).max(6),
  skills: z.array(z.string()).min(1),
});
export type CVContent = z.infer<typeof CVContentSchema>;
export type ExperienceEntry = z.infer<typeof ExperienceEntrySchema>;

/** Full request to /api/cvs (multipart at HTTP layer; parsed server-side) */
export const CreateCvInputSchema = z.object({
  jobId: z.string().optional(),
  pastedText: z.string().optional(),
  fullName: z.string().min(2).max(80),
  email: z.string().email(),
  phone: z.string().min(5).max(30),
  language: z.string().default("en"),
});

/** Generated cover letter content */
export const CoverLetterContentSchema = z.object({
  body: z.string().min(50).max(2000),
});
export type CoverLetterContent = z.infer<typeof CoverLetterContentSchema>;

/** Render request body */
export const RenderInputSchema = z.object({
  templateId: z.string().default("modern"),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#2563eb"),
  fontId: z.string().default("inter"),
});

/** Template metadata (from templates/<name>/meta.json) */
export const TemplateMetaSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  accentDefault: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  fonts: z.array(z.string()),
  preview: z.string(),
});
export type TemplateMeta = z.infer<typeof TemplateMetaSchema>;