import { NextResponse } from "next/server";
import {
  buildLogoutUrl,
  clearAuthCookies,
  readIdToken,
  readRefreshToken,
  refreshTokens,
  setAuthCookies,
  verifyIdToken,
} from "@/lib/cognito";

export async function GET() {
  const idToken = await readIdToken();

  if (idToken) {
    try {
      const u = await verifyIdToken(idToken);
      return NextResponse.json({ user: { id: u.sub, email: u.email, name: u.name ?? null } });
    } catch (err) {
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
      void err;
    }
  }

  return NextResponse.json({ user: null });
}

export async function DELETE() {
  const idToken = await readIdToken();
  await clearAuthCookies();

  // Hand off to Cognito's end-session endpoint so the IdP session is also ended.
  if (idToken) {
    try {
      return NextResponse.json({ ok: true, logoutUrl: buildLogoutUrl(idToken) });
    } catch {
      // fall through
    }
  }

  return NextResponse.json({ ok: true, logoutUrl: null });
}
