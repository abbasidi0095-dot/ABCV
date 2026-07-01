import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/lib/session";
import { prisma } from "@/lib/db";
import { llmJson, isLlmConfigured } from "@/lib/llm";
import { CVContentSchema, JobParsedSchema, type CVContent, type JobParsed } from "@/lib/schemas";
import { CV_GENERATE_SYSTEM } from "@/lib/prompts";
import { validateCVContent } from "@/lib/validator";
import { processPhoto } from "@/lib/photo";

export async function POST(req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch { return unauthorized(); }
  if (!user) return unauthorized();

  const form = await req.formData();
  const jobId = (form.get("jobId") as string | null) ?? undefined;
  const pastedText = (form.get("pastedText") as string | null) ?? undefined;
  const fullName = (form.get("fullName") as string | null)?.trim();
  const email = (form.get("email") as string | null)?.trim();
  const phone = (form.get("phone") as string | null)?.trim();
  const photoFile = form.get("photo") as File | null;

  if (!fullName || !email || !phone) {
    return NextResponse.json({ error: "fullName, email, phone are required" }, { status: 400 });
  }
  if (!jobId && !pastedText) {
    return NextResponse.json({ error: "Either jobId or pastedText is required" }, { status: 400 });
  }

  // Resolve the job context to feed into the generator.
  let job: JobParsed | null = null;
  if (jobId) {
    const row = await prisma.job.findUnique({ where: { id: jobId, userId: user.id } });
    if (!row) return NextResponse.json({ error: "job not found" }, { status: 404 });
    job = JobParsedSchema.parse(row.parsedJson);
  } else if (pastedText) {
    // Parse on the fly if user pasted raw text without saving a Job row.
    job = isLlmConfigured()
      ? await llmJson(JobParsedSchema, "You are a job-description parser.", pastedText.slice(0, 8000), { temperature: 0.2, maxTokens: 1200 })
      : {
          jobTitle: "Software Engineer (mock)",
          company: null, location: null,
          requiredSkills: ["TypeScript", "React", "Node", "SQL"],
          responsibilities: ["Build features"], yearsExperience: 3, keywords: ["fullstack"],
        };
  }

  // Generate experience via LLM (falls back to mock data on any failure).
  let content: CVContent;
  if (isLlmConfigured()) {
    try {
      const userPrompt = `Target role (JSON):\n${JSON.stringify(job)}\n\nApplicant name: "${fullName}"\n\nGenerate a complete CV content object for this applicant tailored to the target role.`;
      content = await llmJson(CVContentSchema, CV_GENERATE_SYSTEM, userPrompt, { temperature: 0.7, maxTokens: 6000 });
    } catch (e) {
      console.warn("LLM CV generation failed, falling back to mock:", (e as Error).message);
      content = mockCVContent(fullName);
    }
  } else {
    content = mockCVContent(fullName);
  }

  // Validate realism (soft — log issues but don't hard-block dev).
  const v = validateCVContent(content);
  if (!v.ok) {
    console.warn("CV realism issues (saving anyway):", v.issues);
    content = v.content;
  }

  // Save photo if provided.
  let photoBase64: string | null = null;
  if (photoFile && photoFile.size > 0) {
    photoBase64 = await processPhoto(Buffer.from(await photoFile.arrayBuffer()));
  }

  const cv = await prisma.cv.create({
    data: {
      userId: user.id,
      jobId: jobId ?? null,
      fullName, email, phone, photoBase64,
      contentJson: content,
    },
  });

  return NextResponse.json({ cv, issues: v.issues });
}

export async function GET() {
  let user;
  try { user = await requireUser(); } catch { return unauthorized(); }
  if (!user) return unauthorized();
  const cvs = await prisma.cv.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ cvs });
}

function mockCVContent(fullName: string): CVContent {
  return {
    summary: `Detail-oriented engineer with a track record of shipping reliable products end to end. ${fullName} thrives in collaborative teams and ships clean, well-tested code.`,
    experience: [
      {
        company: "Northwind Solutions",
        title: "Senior Software Engineer",
        startDate: "Apr 2022", endDate: "Present",
        bullets: [
          "Led migration to a typed Next.js monorepo, cutting build times by 38%.",
          "Shipped a customer-facing analytics dashboard used by 4,200 paying users.",
          "Introduced contract tests across 9 services, reducing prod incidents by 41%.",
        ],
      },
      {
        company: "Acme Logistics",
        title: "Software Engineer",
        startDate: "Jun 2019", endDate: "Mar 2022",
        bullets: [
          "Built REST APIs in Node serving 1.2M requests/day at p99 < 180ms.",
          "Reduced checkout latency by 52% by batching DB queries and adding caching.",
          "Mentored two junior engineers; both promoted within 12 months.",
        ],
      },
      {
        company: "Brightpath Labs",
        title: "Junior Developer",
        startDate: "Aug 2017", endDate: "May 2019",
        bullets: [
          "Implemented feature flags across the React web app, enabling staged rollouts.",
          "Fixed 120+ bugs across the codebase and lifted unit test coverage to 78%.",
        ],
      },
    ],
    skills: ["TypeScript", "React", "Next.js", "Node.js", "PostgreSQL", "REST APIs", "Jest", "CI/CD", "Docker", "GraphQL", "Figma", "Agile"],
  };
}