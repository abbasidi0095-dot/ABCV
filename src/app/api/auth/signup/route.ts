import { NextRequest, NextResponse } from "next/server";
import { signUpUser } from "@/lib/cognito-idp";

function isAwsError(e: unknown, name: string): boolean {
  return e instanceof Error && (e as { name?: string }).name === name;
}

export async function POST(req: NextRequest) {
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

  try {
    await signUpUser({ email, password, name });
    // Cognito leaves the user UNCONFIRMED and emails a verification code.
    return NextResponse.json({ ok: true, needsConfirmation: true });
  } catch (e: unknown) {
    if (isAwsError(e, "UsernameExistsException")) {
      return NextResponse.json(
        { error: "An account with this email already exists. Sign in instead.", code: "EmailTaken" },
        { status: 400 }
      );
    }
    if (isAwsError(e, "InvalidPasswordException")) {
      return NextResponse.json(
        { error: "Password doesn't meet the policy (8+ chars, upper, lower, number).", code: "WeakPassword" },
        { status: 400 }
      );
    }
    console.error("Cognito signUp error:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Sign-up failed" }, { status: 500 });
  }
}
