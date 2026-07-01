import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { email, password, name } = await req.json().catch(() => ({}));

  if (!email || !password || !name) {
    return NextResponse.json({ error: "email, password, and name required" }, { status: 400 });
  }

  // Basic client-side validation isn't enough — enforce server-side too
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

  try {
    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.user.create({
      data: { email, name, hashedPassword },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json(
        { error: "An account with this email already exists.", code: "EmailTaken" },
        { status: 400 }
      );
    }
    console.error("Signup error:", e);
    return NextResponse.json({ error: "Sign-up failed" }, { status: 500 });
  }
}
