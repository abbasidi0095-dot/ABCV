import { NextResponse } from "next/server";
import {
  clearAuthCookies,
  readIdToken,
  readRefreshToken,
  refreshTokens,
  setAuthCookies,
  verifyIdToken,
} from "@/lib/cognito";
import { revokeRefreshToken } from "@/lib/cognito-idp";

export async function GET() {
  const idToken = await readIdToken();

  if (idToken) {
    try {
      const u = await verifyIdToken(idToken);
      return NextResponse.json({ user: { id: u.sub, email: u.email, name: u.name ?? null } });
    } catch {
      // ID token invalid/expired — try a silent refresh before giving up.
      const refreshToken = await readRefreshToken();
      if (refreshToken) {
        try {
          const tokens = await refreshTokens(refreshToken);
          await verifyIdToken(tokens.id_token);
          await setAuthCookies(tokens);
          const u = await verifyIdToken(tokens.id_token);
          return NextResponse.json({ user: { id: u.sub, email: u.email, name: u.name ?? null } });
        } catch {
          // fall through to unauthenticated
        }
      }
    }
  }

  return NextResponse.json({ user: null });
}

export async function DELETE() {
  const refreshToken = await readRefreshToken();
  await clearAuthCookies();

  // Best-effort: revoke the Cognito refresh token so it can't mint new ID tokens.
  if (refreshToken) {
    try {
      await revokeRefreshToken(refreshToken);
    } catch (e) {
      console.warn("Token revocation failed:", e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({ ok: true });
}
