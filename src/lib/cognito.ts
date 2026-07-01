"use client";
import { Amplify } from "aws-amplify";
import { signIn, signUp, confirmSignUp, signOut, getCurrentUser, fetchAuthSession, type SignInOutput } from "aws-amplify/auth";

const REGION = process.env.NEXT_PUBLIC_COGNITO_REGION ?? "eu-north-1";
const POOL_ID = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "";
const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? "";

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: POOL_ID,
      userPoolClientId: CLIENT_ID,
      signUpVerificationMethod: "code",
    },
  },
});

export async function signUpUser(email: string, password: string, name: string) {
  await signUp({
    username: email,
    password,
    options: { userAttributes: { email, name } },
  });
}

export async function confirmUser(email: string, code: string) {
  await confirmSignUp({ username: email, confirmationCode: code });
}

export async function signInUser(email: string, password: string): Promise<SignInOutput> {
  return signIn({ username: email, password });
}

export async function signOutUser() {
  await signOut();
}

export async function getCurrentUserEmail(): Promise<string | null> {
  try {
    const user = await getCurrentUser();
    return user.username;
  } catch {
    return null;
  }
}

export async function getCognitoToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.accessToken?.toString() ?? null;
  } catch {
    return null;
  }
}
