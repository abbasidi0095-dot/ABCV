import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, unauthorized } from "@/lib/session";
import { prisma } from "@/lib/db";
import { scrapeJob, htmlToText } from "@/lib/scrape";
import { llmJson, isLlmConfigured } from "@/lib/llm";
import { JobParsedSchema } from "@/lib/schemas";
import { JOB_PARSE_SYSTEM } from "@/lib/prompts";

const BodySchema = z.object({
  sourceUrl: z.string().url().optional(),
  pastedText: z.string().min(50).optional(),
}).refine((b) => Boolean(b.sourceUrl || b.pastedText), {
  message: "Either sourceUrl or pastedText must be provided.",
});

export async function POST(req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch { return unauthorized(); }
  if (!user) return unauthorized();

  let body;
  try { body = BodySchema.parse(await req.json()); } catch (e) {
    return NextResponse.json({ error: "invalid body", detail: z.string().parse(e?.toString?.() ?? String(e)) }, { status: 400 });
  }

  let rawText = body.pastedText ?? "";
  let rawHtml: string | null = null;
  let finalUrl: string | null = null;

  if (body.sourceUrl) {
    try {
      const { html, finalUrl: fu } = await scrapeJob(body.sourceUrl);
      rawHtml = html;
      finalUrl = fu;
      const t = htmlToText(html);
      if (t.length > 100) rawText = t;
    } catch (e) {
      if (!rawText) {
        return NextResponse.json({ error: "scrape_failed", detail: (e as Error).message }, { status: 502 });
      }
    }
  }

  let parsed: z.infer<typeof JobParsedSchema>;
  if (isLlmConfigured()) {
    try {
      parsed = await llmJson(
        JobParsedSchema,
        JOB_PARSE_SYSTEM,
        `Parse this job posting (input may be raw page text):\n\n"""\n${rawText.slice(0, 8000)}\n"""`,
        { temperature: 0.2, maxTokens: 1500 },
      );
    } catch (e) {
      console.warn("LLM parse failed, falling back to mock:", (e as Error).message);
      parsed = {
        jobTitle: "Software Engineer (mock)",
        company: null,
        location: null,
        requiredSkills: ["TypeScript", "React", "PostgreSQL", "REST APIs", "Testing"],
        responsibilities: ["Build product features", "Maintain codebase", "Collaborate cross-team"],
        yearsExperience: 3,
        keywords: ["fullstack", "react", "apis", "agile", "ci/cd"],
      };
    }
  } else {
    parsed = {
      jobTitle: "Software Engineer (mock)",
      company: null,
      location: null,
      requiredSkills: ["TypeScript", "React", "PostgreSQL", "REST APIs", "Testing"],
      responsibilities: ["Build product features", "Maintain codebase", "Collaborate cross-team"],
      yearsExperience: 3,
      keywords: ["fullstack", "react", "apis", "agile", "ci/cd"],
    };
  }

  const job = await prisma.job.create({
    data: {
      userId: user.id,
      sourceUrl: body.sourceUrl ?? finalUrl,
      pastedText: body.pastedText ?? null,
      rawHtml,
      parsedJson: parsed as object,
    },
  });

  return NextResponse.json({ job });
}

export async function GET() {
  let user;
  try { user = await requireUser(); } catch { return unauthorized(); }
  if (!user) return unauthorized();
  const jobs = await prisma.job.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ jobs });
}