import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { verifyCognitoToken } from "@/lib/cognito-server";
import { prisma } from "@/lib/db";
import { renderCvPdf } from "@/lib/pdf";
import { sendEmail } from "@/lib/email";
import { welcomeEmailHtml } from "@/lib/welcome-email";
import type { CVContent } from "@/lib/schemas";

const SESSION_SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? "fallback-secret-change-me");
const SESSION_COOKIE = "abcv_session";

function sampleCVContent(name: string): CVContent {
  const firstName = name.split(" ")[0];
  return {
    summary: `Creative and results-driven professional with a passion for delivering impact. ${firstName} combines technical expertise with strong communication skills to drive projects from concept to completion.`,
    experience: [
      {
        company: "Stripe",
        title: "Senior Product Engineer",
        startDate: "Jan 2023", endDate: "Present",
        bullets: [
          "Led development of a real-time dashboard serving 10K+ merchants, improving payment visibility by 40%.",
          "Shipped 3 major API iterations with zero downtime, reducing p50 latency by 28%.",
          "Mentored 4 engineers through structured onboarding, cutting ramp-up time by 35%.",
        ],
      },
      {
        company: "Figma",
        title: "Full-Stack Engineer",
        startDate: "Jun 2020", endDate: "Dec 2022",
        bullets: [
          "Built collaborative design review features used by 500K+ monthly active users.",
          "Reduced WebSocket reconnection failures by 65% through a custom retry-with-backoff strategy.",
          "Drove adoption of TypeScript across the monorepo, increasing type coverage from 40% to 92%.",
        ],
      },
      {
        company: "Shopify",
        title: "Software Engineer (New Grad)",
        startDate: "Sep 2018", endDate: "May 2020",
        bullets: [
          "Delivered 15+ merchant-facing features on the checkout team, impacting 2M+ stores.",
          "Optimized GraphQL resolvers, cutting average query time from 320ms to 90ms.",
          "Wrote 200+ integration tests and lifted CI pipeline reliability to 99.7%.",
        ],
      },
    ],
    skills: ["TypeScript", "React", "Node.js", "PostgreSQL", "GraphQL", "AWS", "Docker", "CI/CD", "Python", "Figma API", "REST APIs", "Agile"],
  };
}

async function sendWelcomeEmail(name: string, email: string) {
  try {
    const content = sampleCVContent(name);
    const initials = name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

    const pdf = await renderCvPdf({
      templateId: "modern",
      accentColor: "#2563eb",
      fontId: "inter",
      fullName: name,
      email,
      phone: "",
      roleTitle: "Software Engineer · Sample CV",
      content,
    });

    await sendEmail({
      to: email,
      subject: "Welcome to abCV — your sample CV is inside",
      html: welcomeEmailHtml(name),
      attachments: [
        {
          filename: "Sample_CV.pdf",
          content: pdf.toString("base64"),
          content_type: "application/pdf",
        },
      ],
    });
  } catch (e) {
    console.warn("Welcome email failed to send:", (e as Error).message);
  }
}

/** POST /api/auth/session — verify Cognito token, create session, set cookie */
export async function POST(req: NextRequest) {
  const { accessToken } = await req.json().catch(() => ({}));
  if (!accessToken) {
    return NextResponse.json({ error: "accessToken required" }, { status: 400 });
  }

  const cognitoUser = await verifyCognitoToken(accessToken);
  if (!cognitoUser) {
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }

  const name = cognitoUser.name ?? cognitoUser.email.split("@")[0];

  // Check if this is a new user.
  const existing = await prisma.user.findUnique({ where: { id: cognitoUser.sub } });

  if (!existing) {
    await prisma.user.create({
      data: { id: cognitoUser.sub, email: cognitoUser.email, name },
    });
    // Fire welcome email in background — don't block response.
    sendWelcomeEmail(name, cognitoUser.email);
  } else {
    await prisma.user.update({
      where: { id: cognitoUser.sub },
      data: { email: cognitoUser.email, name: cognitoUser.name ?? undefined },
    });
  }

  // Create a signed session JWT.
  const sessionToken = await new SignJWT({ sub: cognitoUser.sub, email: cognitoUser.email, name })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(SESSION_SECRET);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 86400,
  });

  return NextResponse.json({ ok: true, email: cognitoUser.email });
}

/** DELETE /api/auth/session — clear session cookie */
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return NextResponse.json({ ok: true });
}

/** GET /api/auth/session — return current user or null */
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ user: null });

  try {
    const { payload } = await jwtVerify(token, SESSION_SECRET);
    return NextResponse.json({
      user: { id: payload.sub, email: payload.email, name: payload.name },
    });
  } catch {
    return NextResponse.json({ user: null });
  }
}
