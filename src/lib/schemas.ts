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

/** One generated work-experience entry */
export const ExperienceEntrySchema = z.object({
  company: z.string().min(1),
  title: z.string().min(1),
  startDate: z.string().regex(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}$/),
  endDate: z.string().regex(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}$|^Present$/),
  bullets: z.array(z.string().min(1)).min(2).max(6),
});

/** AI-generated CV content (lives in Cv.contentJson). User-supplied
 *  fullName/email/phone/photo live on the Cv row itself. */
export const CVContentSchema = z.object({
  summary: z.string().min(20).max(400),
  experience: z.array(ExperienceEntrySchema).min(2).max(6),
  skills: z.array(z.string()).min(4),
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
});

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