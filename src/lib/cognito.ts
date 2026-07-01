"use client";
import { signIn, signUp, confirmSignUp, signOut, getCurrentUser, fetchAuthSession, type SignInOutput } from "aws-amplify/auth";

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
