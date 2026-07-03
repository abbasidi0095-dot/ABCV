import { NextResponse } from "next/server";
import { buildAuthorizeUrl, setStateCookie } from "@/lib/cognito";

export async function GET() {
  const { url, state } = await buildAuthorizeUrl();
  await setStateCookie(state);
  return NextResponse.redirect(url);
}
