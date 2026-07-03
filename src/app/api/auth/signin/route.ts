import { NextRequest, NextResponse } from "next/server";
import { initiateAuth } from "@/lib/cognito-idp";
import { setAuthCookies, verifyIdToken } from "@/lib/cognito";
import { ensureLocalUser } from "@/lib/session";
import { sendWelcomeEmail } from "@/lib/welcome";

function isAwsError(e: unknown, name: string): boolean {
  return e instanceof Error && (e as { name?: string }).name === name;
}

export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}));

  if (!email || !password) {
    return NextResponse.json({ error: "email and password required" }, { status: 400 });
  }

  let tokens;
  try {
    tokens = await initiateAuth(email, password);
  } catch (e: unknown) {
    if (isAwsError(e, "UserNotConfirmedException")) {
      return NextResponse.json(
        { error: "Please confirm your account first.", code: "UnconfirmedUser" },
        { status: 400 }
      );
    }
    // UserNotFoundException / NotAuthorizedException — both map to "invalid credentials".
    if (isAwsError(e, "NotAuthorizedException") || isAwsError(e, "UserNotFoundException")) {
      return NextResponse.json({ error: "Invalid email or password", code: "InvalidCredentials" }, { status: 401 });
    }
    console.error("Cognito initiateAuth error:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Sign-in failed" }, { status: 500 });
  }

  // Verify the Cognito-issued ID token (RS256/JWKS) and set httpOnly session cookies.
  let cognitoUser;
  try {
    cognitoUser = await verifyIdToken(tokens.idToken);
  } catch (e) {
    console.error("ID token verification failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Sign-in failed during identity verification" }, { status: 500 });
  }

  await setAuthCookies({
    id_token: tokens.idToken,
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  });

  // Upsert the local User row; fire the welcome email on first sign-in.
  let isNewUser = false;
  try {
    const { isNew } = await ensureLocalUser(cognitoUser);
    isNewUser = isNew;
  } catch (e) {
    console.warn("Local user upsert failed (auth still valid):", e instanceof Error ? e.message : e);
  }
  if (isNewUser) {
    const name = cognitoUser.name ?? cognitoUser.email.split("@")[0];
    void sendWelcomeEmail(name, cognitoUser.email);
  }

  return NextResponse.json({ ok: true, email: cognitoUser.email });
}
