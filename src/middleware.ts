import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE_ID_TOKEN,
  COOKIE_REFRESH_TOKEN,
  verifyIdToken,
} from "@/lib/cognito-shared";

export async function middleware(req: NextRequest) {
  const idToken = req.cookies.get(COOKIE_ID_TOKEN)?.value;

  // Valid, unexpired ID token — pass through.
  if (idToken) {
    try {
      await verifyIdToken(idToken);
      return NextResponse.next();
    } catch {
      // expired or invalid — fall through to refresh / login
    }
  }

  const loginUrl = new URL("/login", req.url);
  const refreshToken = req.cookies.get(COOKIE_REFRESH_TOKEN)?.value;

  if (refreshToken) {
    // Attempt a silent refresh; return there afterwards.
    const refreshUrl = new URL("/api/auth/refresh", req.url);
    refreshUrl.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(refreshUrl);
  }

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/dashboard/:path*", "/new/:path*"],
};
