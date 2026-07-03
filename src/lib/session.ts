import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  readIdToken,
  readRefreshToken,
  refreshTokens,
  setAuthCookies,
  verifyIdToken,
  type CognitoUser,
} from "@/lib/cognito";

async function resolveCognitoUser(): Promise<CognitoUser | null> {
  const idToken = await readIdToken();
  if (!idToken) return null;

  // Fast path: the current ID token is still valid.
  try {
    return await verifyIdToken(idToken);
  } catch {
    // Expired/invalid — try a silent refresh.
    const refreshToken = await readRefreshToken();
    if (!refreshToken) return null;
    try {
      const tokens = await refreshTokens(refreshToken);
      const refreshed = await verifyIdToken(tokens.id_token);
      await setAuthCookies(tokens);
      return refreshed;
    } catch {
      return null;
    }
  }
}

async function getSessionUser(): Promise<CognitoUser | null> {
  try {
    return await resolveCognitoUser();
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const session = await getSessionUser();
  if (!session) return null;

  try {
    const existing = await prisma.user.findUnique({ where: { cognitoSub: session.sub } });
    if (existing) return existing;

    // Shadow row missing (e.g. deleted while session still valid) — recreate it.
    const name = session.name ?? session.email.split("@")[0];
    const byEmail = await prisma.user.findUnique({ where: { email: session.email } });
    if (byEmail) {
      return prisma.user.update({
        where: { id: byEmail.id },
        data: { cognitoSub: session.sub, name, hashedPassword: null },
      });
    }
    return prisma.user.create({
      data: { email: session.email, name, cognitoSub: session.sub },
    });
  } catch {
    // DB unavailable — auth is valid but we can't back it with a User row.
    return null;
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
