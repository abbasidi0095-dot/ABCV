import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { verifyCognitoToken } from "@/lib/cognito-server";
import { prisma } from "@/lib/db";

const SESSION_SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? "fallback-secret-change-me");
const SESSION_COOKIE = "abcv_session";

/** POST /api/auth/session — verify Cognito token, create session, set cookie */
export async function POST(req: NextRequest) {
  const { accessToken } = await req.json().catch(() => ({}));
  if (!accessToken) {
    return NextResponse.json({ error: "accessToken required" }, { status: 400 });
  }

  const user = await verifyCognitoToken(accessToken);
  if (!user) {
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }

  // Upsert user in Prisma (use Cognito sub as id).
  await prisma.user.upsert({
    where: { id: user.sub },
    create: { id: user.sub, email: user.email, name: user.name ?? user.email.split("@")[0] },
    update: { email: user.email, name: user.name ?? undefined },
  });

  // Create a signed session JWT.
  const sessionToken = await new SignJWT({ sub: user.sub, email: user.email, name: user.name })
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

  return NextResponse.json({ ok: true, email: user.email });
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
