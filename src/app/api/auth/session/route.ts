import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const SESSION_SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? "fallback-secret-change-me");
const SESSION_COOKIE = "abcv_session";

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return NextResponse.json({ ok: true });
}

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
