import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch { return unauthorized(); }
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const job = await prisma.job.findUnique({ where: { id, userId: user.id } });
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ job });
}