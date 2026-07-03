import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { User } from "@prisma/client";
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

/**
 * Create/refresh the local shadow User row for a verified Cognito identity.
 * Used by the sign-in route (where it signals "new user" for the welcome email)
 * and by getCurrentUser (when a valid session exists but the row is missing).
 */
export async function ensureLocalUser(cu: CognitoUser): Promise<{ user: User; isNew: boolean }> {
  const name = cu.name ?? cu.email.split("@")[0];

  const existing = await prisma.user.findUnique({ where: { cognitoSub: cu.sub } });
  if (existing) {
    if (existing.email !== cu.email || existing.name !== name) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { email: cu.email, name },
      });
    }
    return { user: existing, isNew: false };
  }

  // A legacy (password-based) row on the same email — link it to the Cognito sub.
  const byEmail = await prisma.user.findUnique({ where: { email: cu.email } });
  if (byEmail) {
    const user = await prisma.user.update({
      where: { id: byEmail.id },
      data: { cognitoSub: cu.sub, name, hashedPassword: null },
    });
    return { user, isNew: false };
  }

  const user = await prisma.user.create({
    data: { email: cu.email, name, cognitoSub: cu.sub },
  });
  return { user, isNew: true };
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
    const { user } = await ensureLocalUser(session);
    return user;
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
