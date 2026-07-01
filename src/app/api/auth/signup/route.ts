import { NextRequest, NextResponse } from "next/server";

const REGION = process.env.COGNITO_REGION ?? "eu-north-1";
const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? "7dvpbjfnnk3irl8eimajk7gu86";

const COGNITO_ENDPOINT = `https://cognito-idp.${REGION}.amazonaws.com`;

export async function POST(req: NextRequest) {
  const { email, password, name } = await req.json().catch(() => ({}));

  if (!email || !password || !name) {
    return NextResponse.json({ error: "email, password, and name required" }, { status: 400 });
  }

  try {
    const res = await fetch(COGNITO_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": "AWSCognitoIdentityProviderService.SignUp",
      },
      body: JSON.stringify({
        ClientId: CLIENT_ID,
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: "email", Value: email },
          { Name: "name", Value: name },
        ],
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      const code = data.__type?.split("#")[1] ?? "Unknown";
      if (code === "UsernameExistsException") {
        return NextResponse.json(
          { error: "An account with this email already exists. Sign in instead.", code },
          { status: 400 }
        );
      }
      if (code === "InvalidPasswordException") {
        return NextResponse.json(
          { error: data.message ?? "Password does not meet requirements.", code },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: data.message ?? "Sign-up failed", code },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, userSub: data.UserSub });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Sign-up failed" }, { status: 500 });
  }
}
