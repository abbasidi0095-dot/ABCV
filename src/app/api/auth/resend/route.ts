import { NextRequest, NextResponse } from "next/server";
import { resendConfirmationCode } from "@/lib/cognito-idp";

function isAwsError(e: unknown, name: string): boolean {
  return e instanceof Error && (e as { name?: string }).name === name;
}

export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}));

  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  try {
    await resendConfirmationCode(email);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (isAwsError(e, "LimitExceededException")) {
      return NextResponse.json({ error: "Too many attempts. Try again later.", code: "RateLimited" }, { status: 429 });
    }
    if (isAwsError(e, "UserNotFoundException")) {
      // Don't reveal whether the email exists.
      return NextResponse.json({ ok: true });
    }
    console.error("Cognito resend error:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Could not resend code" }, { status: 500 });
  }
}
