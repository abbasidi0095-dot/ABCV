import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json().catch(() => ({}));

    if (!email || !password || !name) {
      return NextResponse.json({ error: "email, password, and name required" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters.", code: "WeakPassword" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists. Sign in instead.", code: "EmailTaken" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.user.create({
      data: { email, name, hashedPassword },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const stack = e?.stack ?? "";
    console.error("Signup error:", msg, stack);
    return NextResponse.json(
      { error: "Sign-up failed" },
      { status: 500 }
    );
  }
}
