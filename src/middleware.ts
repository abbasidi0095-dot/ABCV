import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? "fallback-secret-change-me");

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("abcv_session")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    await jwtVerify(token, SESSION_SECRET);
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/dashboard/:path*", "/new/:path*"],
};
