import { NextRequest, NextResponse } from "next/server";
import { confirmSignUpUser } from "@/lib/cognito-idp";

function isAwsError(e: unknown, name: string): boolean {
  return e instanceof Error && (e as { name?: string }).name === name;
}

export async function POST(req: NextRequest) {
  const { email, code } = await req.json().catch(() => ({}));

  if (!email || !code) {
    return NextResponse.json({ error: "email and code required" }, { status: 400 });
  }

  try {
    await confirmSignUpUser(email, code);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (isAwsError(e, "CodeMismatchException")) {
      return NextResponse.json({ error: "Invalid verification code.", code: "InvalidCode" }, { status: 400 });
    }
    if (isAwsError(e, "ExpiredCodeException") || isAwsError(e, "ExpiredCodeException")) {
      return NextResponse.json(
        { error: "Code expired. Request a new one.", code: "ExpiredCode" },
        { status: 400 }
      );
    }
    if (isAwsError(e, "UserNotFoundException")) {
      return NextResponse.json({ error: "No account found for this email.", code: "NoUser" }, { status: 400 });
    }
    if (isAwsError(e, "NotAuthorizedException")) {
      // Already confirmed
      return NextResponse.json({ ok: true, alreadyConfirmed: true });
    }
    console.error("Cognito confirmSignUp error:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Confirmation failed" }, { status: 500 });
  }
}
