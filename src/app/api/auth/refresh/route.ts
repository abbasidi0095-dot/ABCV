import { NextRequest, NextResponse } from "next/server";
import { readRefreshToken, refreshTokens, setAuthCookies, verifyIdToken } from "@/lib/cognito";

export async function GET(req: NextRequest) {
  const next = req.nextUrl.searchParams.get("next") || "/dashboard";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  const refreshToken = await readRefreshToken();
  if (!refreshToken) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  let tokens;
  try {
    tokens = await refreshTokens(refreshToken);
    // Sanity-check the refreshed ID token before trusting it.
    await verifyIdToken(tokens.id_token);
  } catch (e) {
    console.warn("Token refresh failed:", (e as Error).message);
    return NextResponse.redirect(new URL("/login", req.url));
  }

  await setAuthCookies(tokens);
  return NextResponse.redirect(new URL(safeNext, req.url));
}
