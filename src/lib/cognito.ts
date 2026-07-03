import { cookies } from "next/headers";
import {
  COOKIE_ACCESS_TOKEN,
  COOKIE_ID_TOKEN,
  COOKIE_OAUTH_STATE,
  COOKIE_REFRESH_TOKEN,
  cognitoConfig,
  verifyIdToken,
  type CognitoUser,
} from "@/lib/cognito-shared";

export {
  COOKIE_ACCESS_TOKEN,
  COOKIE_ID_TOKEN,
  COOKIE_OAUTH_STATE,
  COOKIE_REFRESH_TOKEN,
  cognitoConfig,
  cognitoIssuer,
  cognitoJwksUrl,
  verifyIdToken,
  type CognitoConfig,
  type CognitoUser,
} from "@/lib/cognito-shared";

function randomState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function buildAuthorizeUrl(cfg = cognitoConfig()): Promise<{ url: string; state: string }> {
  const state = randomState();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    state,
    scope: "openid email profile",
  });
  const url = `https://${cfg.domain}/oauth2/authorize?${params.toString()}`;
  return { url, state };
}

export async function setStateCookie(state: string) {
  const store = await cookies();
  store.set(COOKIE_OAUTH_STATE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
}

export async function consumeStateCookie(state: string | null): Promise<boolean> {
  if (!state) return false;
  const store = await cookies();
  const stored = store.get(COOKIE_OAUTH_STATE)?.value;
  store.delete(COOKIE_OAUTH_STATE);
  return !!stored && stored === state;
}

export interface TokenSet {
  id_token: string;
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

function basicAuthHeader(cfg = cognitoConfig()): string {
  return "Basic " + Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
}

export async function exchangeCodeForTokens(code: string, cfg = cognitoConfig()): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
  });
  const res = await fetch(`https://${cfg.domain}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(cfg),
    },
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "unknown");
    throw new Error(`Cognito token exchange failed (${res.status}): ${err}`);
  }
  return (await res.json()) as TokenSet;
}

export async function refreshTokens(refreshToken: string, cfg = cognitoConfig()): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: cfg.clientId,
  });
  const res = await fetch(`https://${cfg.domain}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(cfg),
    },
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "unknown");
    throw new Error(`Cognito refresh failed (${res.status}): ${err}`);
  }
  const json = (await res.json()) as TokenSet;
  // Cognito does not return a new refresh_token on refresh; keep the existing one.
  return { ...json, refresh_token: refreshToken };
}

export async function setAuthCookies(tokens: TokenSet, cfg = cognitoConfig()) {
  const store = await cookies();
  const common = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: cfg.cookieMaxAgeSec,
  };
  store.set(COOKIE_ID_TOKEN, tokens.id_token, common);
  store.set(COOKIE_ACCESS_TOKEN, tokens.access_token, common);
  if (tokens.refresh_token) {
    store.set(COOKIE_REFRESH_TOKEN, tokens.refresh_token, common);
  }
}

export async function clearAuthCookies() {
  const store = await cookies();
  for (const name of [COOKIE_ID_TOKEN, COOKIE_ACCESS_TOKEN, COOKIE_REFRESH_TOKEN, COOKIE_OAUTH_STATE]) {
    store.set(name, "", { httpOnly: true, path: "/", maxAge: 0 });
  }
}

export function buildLogoutUrl(idToken: string, cfg = cognitoConfig()): string {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    logout_uri: cfg.logoutUri,
    id_token_hint: idToken,
  });
  return `https://${cfg.domain}/logout?${params.toString()}`;
}

export async function readIdToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_ID_TOKEN)?.value ?? null;
}

export async function readRefreshToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_REFRESH_TOKEN)?.value ?? null;
}

export async function verifyUserFromCookie(): Promise<CognitoUser | null> {
  const token = await readIdToken();
  if (!token) return null;
  try {
    return await verifyIdToken(token);
  } catch {
    return null;
  }
}
