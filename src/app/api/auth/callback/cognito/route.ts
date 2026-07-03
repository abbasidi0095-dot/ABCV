import { NextRequest, NextResponse } from "next/server";
import {
  buildAuthorizeUrl,
  consumeStateCookie,
  exchangeCodeForTokens,
  setAuthCookies,
  setStateCookie,
  verifyIdToken,
} from "@/lib/cognito";
import { prisma } from "@/lib/db";
import { sendWelcomeEmail } from "@/lib/welcome";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  if (error) {
    return redirectToLogin(`Cognito error: ${error}${errorDescription ? ` — ${errorDescription}` : ""}`);
  }

  if (!code) {
    // No code — start the Hosted UI flow.
    const { url: authUrl, state: newState } = await buildAuthorizeUrl();
    await setStateCookie(newState);
    return NextResponse.redirect(authUrl);
  }

  // Validate CSRF state.
  const ok = await consumeStateCookie(state);
  if (!ok) {
    return redirectToLogin("Invalid or expired login state. Please try again.");
  }

  // Exchange authorization code for tokens.
  let tokens;
  try {
    tokens = await exchangeCodeForTokens(code);
  } catch (e) {
    console.error("Cognito token exchange failed:", (e as Error).message);
    return redirectToLogin("Login failed during token exchange. Please try again.");
  }

  // Verify the ID token and extract the user identity.
  let cognitoUser;
  try {
    cognitoUser = await verifyIdToken(tokens.id_token);
  } catch (e) {
    console.error("ID token verification failed:", (e as Error).message);
    return redirectToLogin("Login failed during identity verification. Please try again.");
  }

  // Persist the user locally (upsert by Cognito sub).
  const name = cognitoUser.name ?? cognitoUser.email.split("@")[0];
  let isNewUser = false;
  try {
    const existing = await prisma.user.findUnique({ where: { cognitoSub: cognitoUser.sub } });
    if (existing) {
      // Refresh mutable fields if they changed in Cognito.
      if (existing.email !== cognitoUser.email || existing.name !== name) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { email: cognitoUser.email, name },
        });
      }
    } else {
      // Avoid clashing with a legacy (password-based) row on the same email.
      const byEmail = await prisma.user.findUnique({ where: { email: cognitoUser.email } });
      if (byEmail) {
        await prisma.user.update({
          where: { id: byEmail.id },
          data: { cognitoSub: cognitoUser.sub, hashedPassword: null, name },
        });
      } else {
        await prisma.user.create({
          data: { email: cognitoUser.email, name, cognitoSub: cognitoUser.sub },
        });
        isNewUser = true;
      }
    }
  } catch (e) {
    // Auth still succeeds (cookies set below) even if the local row write fails —
    // protected pages will render; data routes that need a User row will 401.
    console.warn("Local user upsert failed (auth still valid):", (e as Error).message);
  }

  // Set session cookies.
  await setAuthCookies(tokens);

  // Fire-and-forget welcome email for brand-new sign-ups.
  if (isNewUser) {
    void sendWelcomeEmail(name, cognitoUser.email);
  }

  return NextResponse.redirect(new URL("/dashboard", url.origin));
}

function redirectToLogin(message: string) {
  const loginUrl = new URL("/login", process.env.NEXTAUTH_URL ?? "http://localhost:3000");
  loginUrl.searchParams.set("error", "auth");
  loginUrl.searchParams.set("message", message);
  return NextResponse.redirect(loginUrl);
}
