import { createRemoteJWKSet, jwtVerify } from "jose";

export const COOKIE_ID_TOKEN = "abcv_id_token";
export const COOKIE_ACCESS_TOKEN = "abcv_access_token";
export const COOKIE_REFRESH_TOKEN = "abcv_refresh_token";
export const COOKIE_OAUTH_STATE = "abcv_oauth_state";

export interface CognitoConfig {
  region: string;
  userPoolId: string;
  clientId: string;
  clientSecret: string;
  domain: string;
  redirectUri: string;
  logoutUri: string;
  appUrl: string;
  cookieMaxAgeSec: number;
}

let cachedConfig: CognitoConfig | null = null;

export function cognitoConfig(): CognitoConfig {
  if (cachedConfig) return cachedConfig;
  const region = process.env.COGNITO_REGION ?? "us-east-1";
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID;
  const clientSecret = process.env.COGNITO_CLIENT_SECRET;
  const domain = process.env.COGNITO_DOMAIN;
  const redirectUri = process.env.COGNITO_REDIRECT_URI;
  const logoutUri = process.env.COGNITO_LOGOUT_URI;
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const days = Number(process.env.COGNITO_TOKEN_VALIDITY_DAYS ?? "30");
  if (!userPoolId || !clientId || !clientSecret || !domain || !redirectUri || !logoutUri) {
    throw new Error(
      "Cognito env not configured. Set COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, COGNITO_CLIENT_SECRET, COGNITO_DOMAIN, COGNITO_REDIRECT_URI, COGNITO_LOGOUT_URI."
    );
  }
  cachedConfig = {
    region,
    userPoolId,
    clientId,
    clientSecret,
    domain,
    redirectUri,
    logoutUri,
    appUrl,
    cookieMaxAgeSec: Math.max(1, Math.floor(days * 86400)),
  };
  return cachedConfig;
}

export function cognitoIssuer(cfg = cognitoConfig()): string {
  return `https://cognito-idp.${cfg.region}.amazonaws.com/${cfg.userPoolId}`;
}

export function cognitoJwksUrl(cfg = cognitoConfig()): string {
  return `${cognitoIssuer(cfg)}/.well-known/jwks.json`;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks(cfg = cognitoConfig()) {
  if (!jwks) jwks = createRemoteJWKSet(new URL(cognitoJwksUrl(cfg)));
  return jwks;
}

export interface CognitoUser {
  sub: string;
  email: string;
  name?: string;
}

export async function verifyIdToken(idToken: string, cfg = cognitoConfig()): Promise<CognitoUser> {
  const { payload } = await jwtVerify(idToken, getJwks(cfg), {
    issuer: cognitoIssuer(cfg),
    audience: cfg.clientId,
    algorithms: ["RS256"],
  });
  if (payload.token_use && payload.token_use !== "id") {
    throw new Error(`unexpected token_use: ${payload.token_use}`);
  }
  const sub = payload.sub;
  const email = payload.email;
  if (typeof sub !== "string" || typeof email !== "string") {
    throw new Error("id token missing sub or email");
  }
  return { sub, email, name: typeof payload.name === "string" ? payload.name : undefined };
}
