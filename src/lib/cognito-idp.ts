import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  InitiateAuthCommand,
  type SignUpCommandOutput,
} from "@aws-sdk/client-cognito-identity-provider";
import { createHmac } from "node:crypto";
import { cognitoConfig } from "@/lib/cognito-shared";

let client: CognitoIdentityProviderClient | null = null;
function idp(cfg = cognitoConfig()): CognitoIdentityProviderClient {
  if (!client) {
    client = new CognitoIdentityProviderClient({ region: cfg.region });
  }
  return client;
}

/** SECRET_HASH = base64(HMAC-SHA256(clientSecret, username + clientId)) — required for confidential clients. */
export function secretHash(username: string, cfg = cognitoConfig()): string {
  return createHmac("sha256", cfg.clientSecret).update(username + cfg.clientId).digest("base64");
}

function basicAuthHeader(cfg = cognitoConfig()): string {
  return "Basic " + Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
}

export interface SignUpInput {
  email: string;
  password: string;
  name: string;
}

export async function signUpUser({ email, password, name }: SignUpInput): Promise<SignUpCommandOutput> {
  const cfg = cognitoConfig();
  return idp(cfg).send(
    new SignUpCommand({
      ClientId: cfg.clientId,
      SecretHash: secretHash(email, cfg),
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: "email", Value: email },
        { Name: "name", Value: name },
      ],
    })
  );
}

export async function confirmSignUpUser(email: string, code: string): Promise<void> {
  const cfg = cognitoConfig();
  await idp(cfg).send(
    new ConfirmSignUpCommand({
      ClientId: cfg.clientId,
      SecretHash: secretHash(email, cfg),
      Username: email,
      ConfirmationCode: code.trim(),
    })
  );
}

export async function resendConfirmationCode(email: string): Promise<void> {
  const cfg = cognitoConfig();
  await idp(cfg).send(
    new ResendConfirmationCodeCommand({
      ClientId: cfg.clientId,
      SecretHash: secretHash(email, cfg),
      Username: email,
    })
  );
}

export interface AuthTokens {
  idToken: string;
  accessToken: string;
  refreshToken?: string;
}

/**
 * USER_PASSWORD_AUTH for a confidential client. Returns tokens on success.
 * Throws the raw AWS SDK error otherwise — callers inspect `error.name`:
 *   - "UserNotConfirmedException" -> ask for a confirmation code
 *   - "NotAuthorizedException"    -> wrong credentials / user disabled
 *   - "UserNotFoundException"     -> no such user
 */
export async function initiateAuth(email: string, password: string): Promise<AuthTokens> {
  const cfg = cognitoConfig();
  const res = await idp(cfg).send(
    new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: cfg.clientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
        SECRET_HASH: secretHash(email, cfg),
      },
    })
  );

  if (res.AuthenticationResult?.IdToken && res.AuthenticationResult.AccessToken) {
    return {
      idToken: res.AuthenticationResult.IdToken,
      accessToken: res.AuthenticationResult.AccessToken,
      refreshToken: res.AuthenticationResult.RefreshToken,
    };
  }

  // A challenge (e.g. NEW_PASSWORD_REQUIRED, SMS_MFA). We don't support these in v0.2.
  throw new Error(`UNSUPPORTED_CHALLENGE:${res.ChallengeName ?? "UNKNOWN"}`);
}

/** Best-effort refresh-token revocation at sign-out. */
export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  const cfg = cognitoConfig();
  await fetch(`https://${cfg.domain}/oauth2/revoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(cfg),
    },
    body: new URLSearchParams({ token: refreshToken, client_id: cfg.clientId }),
    cache: "no-store",
  });
}
