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

  // Generate cover letter via LLM.
  const jobParsed = cv.job?.parsedJson as { jobTitle?: string; requiredSkills?: string[]; responsibilities?: string[] } | undefined;
  const cvContent = cv.contentJson as { summary?: string; experience?: { title?: string; bullets?: string[] }[]; skills?: string[]; targetRole?: string } | undefined;

  const expHighlights = (cvContent?.experience ?? [])
    .slice(0, 3)
    .map((e) => `${e.title ?? "Role"}: ${(e.bullets ?? []).slice(0, 2).join(" | ")}`)
    .join("\n");

  let bodyText: string;
  if (isLlmConfigured() && cv.job && jobParsed) {
    try {
      const userPrompt = `Language: ${language}
Applicant name: ${cv.fullName}
Role title: ${jobParsed.jobTitle ?? "unknown"}
Key skills: ${(jobParsed.requiredSkills ?? []).join(", ")}
Responsibilities: ${(jobParsed.responsibilities ?? []).join(", ")}

Applicant's CV summary: ${cvContent?.summary ?? ""}
Applicant's CV experience highlights:
${expHighlights}
Applicant's skills: ${(cvContent?.skills ?? []).join(", ")}

Generate a professional cover letter body for this role that reflects the applicant's real achievements. Write ALL content in the specified language. Do NOT mention any specific past employer company names.`;
      const result = await llmJson(CoverLetterContentSchema, COVER_LETTER_SYSTEM, userPrompt, { temperature: 0.7, maxTokens: 2000 });
      bodyText = result.body;
    } catch (e) {
      console.warn("LLM cover letter generation failed:", (e as Error).message);
      bodyText = defaultCoverLetter(language, jobParsed?.jobTitle ?? cvContent?.targetRole ?? "the position");
    }
  } else {
    bodyText = defaultCoverLetter(language, jobParsed?.jobTitle ?? cvContent?.targetRole ?? "the position");
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

function defaultCoverLetter(language: string, roleTitle: string): string {
  const letters: Record<string, string> = {
    en: `I am writing to express my interest in the ${roleTitle} position. With a strong background in software engineering and a track record of delivering impactful solutions, I am confident in my ability to contribute effectively to your team.

Throughout my career, I have developed expertise in full-stack development, system architecture, and cross-functional collaboration. I am passionate about building products that solve real problems and thrive in fast-paced, innovative environments.

I am eager to bring my skills and experience to this role and would welcome the opportunity to discuss how I can add value to your organization. Thank you for your time and consideration.`,
    fr: `Je vous écris pour vous exprimer mon intérêt pour le poste de ${roleTitle}. Fort d'une solide expérience en génie logiciel et d'un parcours orienté résultats, je suis confiant dans ma capacité à contribuer efficacement à votre équipe.

Tout au long de ma carrière, j'ai développé une expertise en développement full-stack, architecture système et collaboration interfonctionnelle. Je suis passionné par la création de produits qui résolvent des problèmes concrets et je m'épanouis dans des environnements dynamiques et innovants.

Je serais ravi de mettre mes compétences et mon expérience au service de ce poste et de discuter de la manière dont je peux contribuer à votre organisation. Merci de votre temps et de votre considération.`,
    es: `Le escribo para expresar mi interés en el puesto de ${roleTitle}. Con una sólida formación en ingeniería de software y una trayectoria demostrada entregando soluciones impactantes, confío en mi capacidad para contribuir de manera efectiva a su equipo.

A lo largo de mi carrera, he desarrollado experiencia en desarrollo full-stack, arquitectura de sistemas y colaboración interfuncional. Me apasiona crear productos que resuelvan problemas reales y prospero en entornos dinámicos e innovadores.

Estoy deseoso de aportar mis habilidades y experiencia a este puesto y me encantaría tener la oportunidad de conversar sobre cómo puedo agregar valor a su organización. Gracias por su tiempo y consideración.`,
    de: `Ich schreibe, um mein Interesse an der Position als ${roleTitle} zu bekunden. Mit einem starken Hintergrund in Software Engineering und einer nachweisbaren Erfolgsbilanz bei der Entwicklung wirkungsvoller Lösungen bin ich zuversichtlich, dass ich Ihr Team effektiv unterstützen kann.

Während meiner Karriere habe ich Expertise in Full-Stack-Entwicklung, Systemarchitektur und übergreifender Zusammenarbeit aufgebaut. Ich bin leidenschaftlich daran interessiert, Produkte zu entwickeln, die echte Probleme lösen, und gedeihe in dynamischen, innovativen Umgebungen.

Ich würde mich freuen, meine Fähigkeiten und Erfahrungen in diese Rolle einzubringen und die Gelegenheit zu haben zu besprechen, wie ich Ihrer Organisation Mehrwert bieten kann. Vielen Dank für Ihre Zeit und Ihre Überlegung.`,
  };
  return letters[language] ?? letters.en;
}
