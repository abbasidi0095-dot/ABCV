import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import crypto from "crypto";

const OTP_EXPIRY_MINUTES = 15;
const OTP_SECRET = process.env.NEXTAUTH_SECRET ?? "fallback-secret-change-me";

function hashOtp(email: string, otp: string): string {
  return crypto
    .createHash("sha256")
    .update(`${email}:${otp}:${OTP_SECRET}`)
    .digest("hex");
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function otpEmailHtml(otp: string): string {
  return `<html><body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif">
<table width="100%"><tr><td align="center" style="padding:32px">
<table width="440" style="background:#fff;border-radius:8px;border:1px solid #e5e7eb">
<tr><td style="background:#7c3aed;padding:24px;text-align:center">
<h1 style="margin:0;font-size:20px;color:#fff"><span style="color:#fbbf24">ab</span>CV</h1>
</td></tr>
<tr><td style="padding:24px;text-align:center">
<p style="margin:0 0 16px;font-size:14px;color:#6b7280">Your verification code:</p>
<p style="margin:0;font-size:32px;font-weight:bold;color:#7c3aed;letter-spacing:8px">${otp}</p>
<p style="margin:16px 0 0;font-size:12px;color:#9ca3af">Expires in ${OTP_EXPIRY_MINUTES} minutes</p>
</td></tr></table></td></tr></table></body></html>`;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { action, email, code } = body;

  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  if (action === "send") {
    const otp = generateOtp();
    const codeHash = hashOtp(email, otp);

    await prisma.otp.deleteMany({ where: { email } });

    await prisma.otp.create({
      data: {
        email,
        codeHash,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
      },
    });

    try {
      await sendEmail({
        to: email,
        subject: "abCV — your verification code",
        html: otpEmailHtml(otp),
      });
    } catch (e) {
      return NextResponse.json(
        { error: "Failed to send verification email" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "verify") {
    if (!code) {
      return NextResponse.json({ error: "code required" }, { status: 400 });
    }

    const record = await prisma.otp.findFirst({
      where: { email, expiresAt: { gte: new Date() } },
      orderBy: { createdAt: "desc" },
    });

    if (!record) {
      return NextResponse.json(
        { error: "No valid OTP found. Request a new one." },
        { status: 400 }
      );
    }

    const expectedHash = hashOtp(email, code);
    if (record.codeHash !== expectedHash) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    // Delete used OTP
    await prisma.otp.delete({ where: { id: record.id } });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "invalid action" }, { status: 400 });
}
