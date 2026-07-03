import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/lib/session";
import { prisma } from "@/lib/db";
import { llmJson, isLlmConfigured } from "@/lib/llm";
import { CVContentSchema, JobParsedSchema, type CVContent, type JobParsed } from "@/lib/schemas";
import { CV_GENERATE_SYSTEM } from "@/lib/prompts";
import { validateCVContent } from "@/lib/validator";
import { processPhoto } from "@/lib/photo";
import { buildLanguages } from "@/lib/languages";

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
  const language = (form.get("language") as string | null) ?? "en";
  const numExperiencesRaw = (form.get("numExperiences") as string | null) ?? "3";
  const numExperiences = Math.min(4, Math.max(1, parseInt(numExperiencesRaw, 10) || 3));
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
    // When the LLM is configured, skip the separate parse call — the CV
    // generator infers the role directly from the raw pasted text in one shot.
    if (!isLlmConfigured()) {
      job = {
        jobTitle: "Professional (mock)",
        company: null, location: null,
        requiredSkills: ["Communication", "Organization", "Teamwork", "Problem-solving"],
        responsibilities: ["Deliver on responsibilities", "Collaborate with team"], yearsExperience: 3, keywords: ["professional"],
      };
    }
  }

  // Generate experience via LLM (falls back to mock data on any failure).
  let content: CVContent;
  if (isLlmConfigured()) {
    try {
      let userPrompt: string;
      if (job) {
        // Saved job (jobId path) — structured role JSON available.
        userPrompt = `Language: ${language}\nExperience entries to generate: ${numExperiences}\nTarget role (JSON):\n${JSON.stringify(job)}\n\nApplicant name: "${fullName}"\n\nGenerate a complete CV content object with EXACTLY ${numExperiences} experience entries, tailored to the target role. Adapt companies, terminology, and achievements to the role's actual industry (NOT software/tech unless the role is a tech role). Companies must be realistic lesser-known/regional/mid-size organizations in that industry; include at most ONE globally well-known brand. Write ALL textual content (summary, bullets, skills) in the specified language — BUT dates must ALWAYS be English month abbreviations (Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec) followed by a year, e.g. "Mar 2021".`;
      } else {
        // pastedText path — pass the raw description inline; the model infers the role.
        userPrompt = `Language: ${language}\nExperience entries to generate: ${numExperiences}\n\nRaw job description:\n${(pastedText ?? "").slice(0, 4000)}\n\nApplicant name: "${fullName}"\n\nInfer the target role, industry, and required skills from the raw job description above. Generate a complete CV content object with EXACTLY ${numExperiences} experience entries, tailored to that role. Adapt companies, terminology, and achievements to the role's actual industry (NOT software/tech unless the role is a tech role). Companies must be realistic lesser-known/regional/mid-size organizations in that industry; include at most ONE globally well-known brand. Set the "targetRole" field to the inferred job title. Write ALL textual content (summary, bullets, skills) in the specified language — BUT dates must ALWAYS be English month abbreviations (Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec) followed by a year, e.g. "Mar 2021".`;
      }
      content = await llmJson(CVContentSchema, CV_GENERATE_SYSTEM, userPrompt, { temperature: 0.7, maxTokens: 4000 });
    } catch (e) {
      console.warn("LLM CV generation failed, falling back to mock:", (e as Error).message);
      content = mockCVContent(fullName, job, numExperiences);
    }
  } else {
    content = mockCVContent(fullName, job, numExperiences);
  }

  // Add deterministic languages section based on CV output language.
  content.languages = buildLanguages(language);
  // Ensure targetRole is set from the saved job if the model didn't populate it.
  if (!content.targetRole && job?.jobTitle) content.targetRole = job.jobTitle;

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
      language,
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

type IndustryProfile = {
  summary: string;
  skills: string[];
  roles: { company: string; title: string; bullets: string[] }[];
};

const INDUSTRY_PROFILES: Record<string, IndustryProfile> = {
  tech: {
    summary: "Detail-oriented software professional with a track record of building and shipping reliable products end to end.",
    skills: ["JavaScript", "React", "Node.js", "API Design", "Testing", "Git", "Agile", "SQL", "Documentation", "Code Review", "CI/CD", "Troubleshooting"],
    roles: [
      { company: "Cloudflare", title: "Senior Software Engineer", bullets: [
        "Led migration to a typed monorepo, cutting build times by 38% across teams.",
        "Shipped a customer-facing analytics dashboard used by 4,200 paying users.",
        "Introduced contract tests across 9 services, reducing incidents by 41%.",
      ] },
      { company: "Maple Systems", title: "Software Engineer", bullets: [
        "Built REST APIs serving 1.2M requests/day at p99 under 180ms.",
        "Reduced checkout latency 52% by batching DB queries and caching results.",
        "Mentored two junior engineers; both promoted within 12 months.",
      ] },
      { company: "Beacon Labs", title: "Junior Developer", bullets: [
        "Implemented feature flags across the web app, enabling staged rollouts.",
        "Fixed 120+ bugs and lifted unit test coverage to 78%.",
        "Documented onboarding flows adopted by the whole engineering team.",
      ] },
    ],
  },
  healthcare: {
    summary: "Compassionate healthcare professional dedicated to delivering high-quality patient care and improving clinical outcomes.",
    skills: ["Patient Care", "Clinical Assessment", "EMR/EHR", "Vital Signs Monitoring", "Medication Administration", "Infection Control", "Patient Education", "Team Coordination", "Documentation", "CPR/BLS", "Time Management", "Communication"],
    roles: [
      { company: "Riverside Regional Medical Center", title: "Registered Nurse", bullets: [
        "Managed care for 6-8 patients per shift, improving satisfaction scores 22%.",
        "Reduced medication errors 30% by leading a double-check protocol rollout.",
        "Trained 12 new graduate nurses on unit procedures and EMR documentation.",
      ] },
      { company: "Lakeside Community Hospital", title: "Staff Nurse", bullets: [
        "Coordinated multidisciplinary rounds, cutting average length of stay 1.2 days.",
        "Implemented a fall-prevention bundle that reduced falls by 40% over six months.",
        "Maintained 100% compliance with charting standards across 3 years.",
      ] },
      { company: "Greendale Clinic", title: "Nursing Assistant", bullets: [
        "Assisted 20+ patients daily with mobility, hygiene, and vital sign monitoring.",
        "Streamlined intake paperwork, cutting patient wait times by 15 minutes.",
        "Earned 'Staff of the Quarter' for consistent compassionate care delivery.",
      ] },
    ],
  },
  marketing: {
    summary: "Results-driven marketing professional skilled in campaign strategy, content creation, and data-driven growth.",
    skills: ["Campaign Management", "Content Strategy", "SEO", "Social Media", "Google Analytics", "Copywriting", "Email Marketing", "A/B Testing", "Brand Management", "Budget Management", "Presentation", "Stakeholder Communication"],
    roles: [
      { company: "Northwind Agency", title: "Marketing Manager", bullets: [
        "Led a rebrand that lifted unaided brand awareness 18% in target segments.",
        "Managed $450K annual budget across paid and organic channels at 3.2x ROI.",
        "Grew email subscriber base 35% through segmented lifecycle campaigns.",
      ] },
      { company: "Harbor Media Group", title: "Marketing Specialist", bullets: [
        "Launched 6 product campaigns generating 12K qualified leads in one quarter.",
        "Improved organic search traffic 27% via SEO content and technical fixes.",
        "Coordinated influencer partnerships reaching 2M+ targeted impressions.",
      ] },
      { company: "Cornerstone Creative", title: "Marketing Coordinator", bullets: [
        "Produced weekly social calendar lifting engagement 40% across platforms.",
        "Managed event logistics for 15 trade shows and webinars attended by 5,000+.",
        "Built reporting dashboards tracked weekly by the leadership team.",
      ] },
    ],
  },
  default: {
    summary: "Versatile professional with a record of delivering results, leading teams, and improving operations across diverse organizations.",
    skills: ["Communication", "Project Management", "Process Improvement", "Stakeholder Management", "Microsoft Office", "Data Analysis", "Team Leadership", "Problem Solving", "Budgeting", "Scheduling", "Reporting", "Customer Service"],
    roles: [
      { company: "Summit Group", title: "Operations Specialist", bullets: [
        "Streamlined workflows that cut average processing time by 25%.",
        "Coordinated cross-functional projects serving 300+ internal users.",
        "Reduced monthly reporting turnaround from 5 days to 2 days.",
      ] },
      { company: "Meridian Services", title: "Team Coordinator", bullets: [
        "Managed scheduling and logistics for a team of 18 across three sites.",
        "Improved client satisfaction scores 15% through faster response times.",
        "Trained 8 new hires on standard operating procedures within 90 days.",
      ] },
      { company: "Greenfield Associates", title: "Junior Associate", bullets: [
        "Supported daily operations handling 50+ intake requests efficiently.",
        "Maintained accurate records database with 99% data integrity.",
        "Recognized for dependable support during peak seasonal demand.",
      ] },
    ],
  },
};

function pickIndustry(job: JobParsed | null): string {
  const t = (job?.jobTitle ?? "").toLowerCase();
  const s = (job?.requiredSkills ?? []).join(" ").toLowerCase();
  const blob = `${t} ${s}`;
  if (/nurse| nurs|rnt|clinical|patient|medical|health|care|therap|physician|hospital|pharmac|dental|surg|cna|lpn/.test(blob)) return "healthcare";
  if (/market|brand|seo|content|campaign|social media|copywrit|advertis/.test(blob)) return "marketing";
  if (/engineer|develop|software|frontend|backend|fullstack|devops|data|programmer|coding|java|react|python|node|sql|api/.test(blob)) return "tech";
  return "default";
}

function mockCVContent(fullName: string, job: JobParsed | null, numExperiences: number): CVContent {
  const industry = pickIndustry(job);
  const profile = INDUSTRY_PROFILES[industry] ?? INDUSTRY_PROFILES.default;
  const roleTitle = job?.jobTitle ?? profile.roles[0].title;
  const exp = profile.roles.slice(0, Math.min(numExperiences, profile.roles.length));
  // Pad with generic entries if more experiences requested than profile roles exist.
  const SLICE = [["Jan 2022", "Present"], ["Jun 2019", "Dec 2021"], ["Aug 2017", "May 2019"], ["Mar 2015", "Jul 2017"], ["Sep 2012", "Feb 2015"], ["Apr 2009", "Aug 2012"], ["Jan 2006", "Mar 2009"], ["Jun 2003", "Dec 2005"]];
  const experience = exp.map((r, i) => ({
    company: r.company,
    title: i === 0 ? roleTitle : r.title,
    startDate: SLICE[i][0],
    endDate: SLICE[i][1],
    bullets: r.bullets,
  }));
  return {
    summary: `${profile.summary} ${fullName} thrives in collaborative teams and consistently delivers measurable results.`,
    experience,
    skills: profile.skills,
    languages: buildLanguages("en"),
  };
}