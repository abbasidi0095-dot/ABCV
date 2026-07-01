import { CognitoIdentityProvider } from "@aws-sdk/client-cognito-identity-provider";
import { jwtVerify, importJWK, type JWK } from "jose";

const REGION = process.env.COGNITO_REGION ?? "eu-north-1";
const POOL_ID = process.env.COGNITO_USER_POOL_ID ?? "";

const cognito = new CognitoIdentityProvider({ region: REGION });

interface CognitoUser {
  sub: string;
  email: string;
  name?: string;
}

interface Jwk {
  kid: string;
  kty: string;
  alg: string;
  n: string;
  e: string;
  use?: string;
}

let cachedKeys: { keys: Jwk[]; fetchedAt: number } | null = null;

async function getJwks(): Promise<Jwk[]> {
  if (cachedKeys && Date.now() - cachedKeys.fetchedAt < 3600000) return cachedKeys.keys;
  const jwksUrl = `https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}/.well-known/jwks.json`;
  const res = await fetch(jwksUrl);
  const body = await res.json() as { keys: Jwk[] };
  cachedKeys = { keys: body.keys, fetchedAt: Date.now() };
  return body.keys;
}

/** Verify a Cognito access token and return user info. */
export async function verifyCognitoToken(token: string): Promise<CognitoUser | null> {
  try {
    const decoded = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString()) as { kid?: string };
    if (!decoded.kid) return null;

    const keys = await getJwks();
    const jwk = keys.find((k) => k.kid === decoded.kid);
    if (!jwk) return null;

    const publicKey = await importJWK(jwk as unknown as JWK, jwk.alg);
    const { payload } = await jwtVerify(token, publicKey, { algorithms: [jwk.alg] });

    return {
      sub: payload.sub as string,
      email: payload.email as string,
      name: payload.name as string | undefined,
    };
  } catch {
    return null;
  }
}

/** Admin get user from Cognito */
export async function adminGetUser(sub: string): Promise<CognitoUser | null> {
  try {
    const r = await cognito.adminGetUser({ UserPoolId: POOL_ID, Username: sub });
    const email = r.UserAttributes?.find((a) => a.Name === "email")?.Value ?? "";
    const name = r.UserAttributes?.find((a) => a.Name === "name")?.Value ?? undefined;
    return { sub, email, name };
  } catch {
    return null;
  }
}

export { cognito, REGION, POOL_ID };
export type { CognitoUser };
