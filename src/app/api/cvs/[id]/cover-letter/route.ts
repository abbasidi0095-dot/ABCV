import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/lib/session";
import { prisma } from "@/lib/db";
import { llmJson, isLlmConfigured } from "@/lib/llm";
import { CoverLetterContentSchema } from "@/lib/schemas";
import { COVER_LETTER_SYSTEM } from "@/lib/prompts";
import { renderCoverLetterPdf } from "@/lib/pdf";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch { return unauthorized(); }
  if (!user) return unauthorized();
  const { id } = await ctx.params;

  const cv = await prisma.cv.findUnique({ where: { id, userId: user.id }, include: { job: true } });
  if (!cv) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Parse optional body for language override.
  let language = cv.language || "en";
  try {
    const j = await req.json();
    if (j?.language) language = j.language;
  } catch { /* use default */ }

  // Generate the cover letter from the applicant's OWN CV content (always
  // available), enriched with the job's requirements when a linked job exists.
  // No mock/generic text — the letter reflects the user's real input.
  const jobParsed = cv.job?.parsedJson as { jobTitle?: string; requiredSkills?: string[]; responsibilities?: string[] } | undefined;
  const cvContent = cv.contentJson as { summary?: string; experience?: { title?: string; bullets?: string[] }[]; skills?: string[]; targetRole?: string } | undefined;

  const roleTitle = cvContent?.targetRole ?? jobParsed?.jobTitle ?? "the position";
  const expHighlights = (cvContent?.experience ?? [])
    .slice(0, 3)
    .map((e) => `${e.title ?? "Role"}: ${(e.bullets ?? []).slice(0, 2).join(" | ")}`)
    .join("\n");

  const jobContext = jobParsed
    ? `Target role (from the job posting): ${jobParsed.jobTitle ?? roleTitle}
Key required skills: ${(jobParsed.requiredSkills ?? []).join(", ")}
Core responsibilities: ${(jobParsed.responsibilities ?? []).join(", ")}`
    : `Target role: ${roleTitle}`;

  let bodyText: string;
  if (isLlmConfigured()) {
    try {
      const userPrompt = `Language: ${language}
Applicant name: ${cv.fullName}

${jobContext}

Applicant's CV summary: ${cvContent?.summary ?? ""}
Applicant's CV experience highlights:
${expHighlights}
Applicant's skills: ${(cvContent?.skills ?? []).join(", ")}

Write a professional cover letter body for this role, based ONLY on the
applicant's CV content above. Do NOT invent achievements, skills, or
experiences that are not present in the CV. Paraphrase 1-2 real achievements
from the experience highlights (do not name past employers). Naturally mention
skills that appear in the applicant's CV. Write ALL content in the specified
language. Do NOT mention any specific company name.`;
      const result = await llmJson(CoverLetterContentSchema, COVER_LETTER_SYSTEM, userPrompt, { temperature: 0.7, maxTokens: 2000 });
      bodyText = result.body;
    } catch (e) {
      console.warn("LLM cover letter generation failed:", (e as Error).message);
      bodyText = defaultCoverLetter(language, roleTitle, cvContent?.skills);
    }
  } else {
    bodyText = defaultCoverLetter(language, roleTitle, cvContent?.skills);
  }

  // Persist.
  await prisma.cv.updateMany({
    where: { id, userId: user.id },
    data: { coverLetterText: bodyText, language },
  });

  return NextResponse.json({ body: bodyText });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch { return unauthorized(); }
  if (!user) return unauthorized();
  const { id } = await ctx.params;

  const cv = await prisma.cv.findUnique({ where: { id, userId: user.id } });
  if (!cv) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (!cv.coverLetterText) {
    return NextResponse.json({ body: null });
  }

  // Accept ?download=true to return PDF
  const url = new URL(req.url);
  if (url.searchParams.get("download") === "true") {
    const jobRow = cv.jobId ? await prisma.job.findUnique({ where: { id: cv.jobId } }) : null;
    const jobParsed = jobRow?.parsedJson as { jobTitle?: string } | undefined;
    const roleTitle = jobParsed?.jobTitle ?? null;
    const pdf = await renderCoverLetterPdf({
      fullName: cv.fullName,
      email: cv.email,
      phone: cv.phone,
      roleTitle,
      body: cv.coverLetterText,
      isPro: user.isPro,
    });
    const safeName = cv.fullName.replace(/[^a-z0-9]+/gi, "_");
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${safeName}_Cover_Letter.pdf"`,
        "content-length": String(pdf.byteLength),
      },
    });
  }

  return NextResponse.json({ body: cv.coverLetterText });
}

function defaultCoverLetter(language: string, roleTitle: string, skills?: string[]): string {
  const top = (skills ?? []).slice(0, 3).join(", ");
  const skillLine = top
    ? `My background has equipped me with strengths in ${top}, among others.`
    : "My background has equipped me with a broad, adaptable skill set.";
  const letters: Record<string, string> = {
    en: `I am writing to express my interest in the ${roleTitle} position. ${skillLine} I am confident in my ability to contribute effectively to your team.

Throughout my career, I have focused on delivering measurable impact, collaborating across teams, and continuously raising the quality of my work. I am drawn to this role because it aligns with both my strengths and the direction I want to grow.

I would welcome the opportunity to discuss how my experience can add value to your organization. Thank you for your time and consideration.`,
    fr: `Je vous écris pour vous exprimer mon intérêt pour le poste de ${roleTitle}. ${skillLine} Je suis confiant dans ma capacité à contribuer efficacement à votre équipe.

Tout au long de mon parcours, je me suis concentré sur la livraison d'un impact mesurable, la collaboration entre équipes et l'amélioration continue de la qualité de mon travail. Ce poste correspond à la fois à mes points forts et à la direction dans laquelle je souhaite évoluer.

Je serais ravi de discuter de la manière dont mon expérience peut apporter de la valeur à votre organisation. Merci de votre temps et de votre considération.`,
    es: `Le escribo para expresar mi interés en el puesto de ${roleTitle}. ${skillLine} Confío en mi capacidad para contribuir de manera efectiva a su equipo.

A lo largo de mi trayectoria, me he centrado en lograr un impacto medible, colaborar entre equipos y mejorar continuamente la calidad de mi trabajo. Este puesto atrae porque coincide con mis fortalezas y con la dirección en la que quiero crecer.

Me encantaría tener la oportunidad de conversar sobre cómo mi experiencia puede aportar valor a su organización. Gracias por su tiempo y consideración.`,
    de: `Ich schreibe, um mein Interesse an der Position als ${roleTitle} zu bekunden. ${skillLine} Ich bin zuversichtlich, dass ich Ihr Team effektiv unterstützen kann.

Während meiner Laufbahn habe ich mich darauf konzentriert, messbare Wirkung zu erzielen, teamübergreifend zusammenzuarbeiten und die Qualität meiner Arbeit kontinuierlich zu steigern. Diese Rolle reizt mich, weil sie sowohl zu meinen Stärken als auch zu meiner gewünschten Entwicklung passt.

Ich würde mich freuen, die Gelegenheit zu haben zu besprechen, wie meine Erfahrung Ihrer Organisation Mehrwert bieten kann. Vielen Dank für Ihre Zeit und Ihre Überlegung.`,
  };
  return letters[language] ?? letters.en;
}
