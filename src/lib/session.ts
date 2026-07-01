import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

const SESSION_SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? "fallback-secret-change-me");

interface SessionUser {
  id: string;
  email: string;
  name?: string;
}

async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("abcv_session")?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, SESSION_SECRET);
    if (!payload.sub) return null;
    return { id: payload.sub as string, email: payload.email as string, name: payload.name as string | undefined };
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const session = await getSessionUser();
  if (!session) return null;
  return prisma.user.findUnique({ where: { id: session.id } });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
