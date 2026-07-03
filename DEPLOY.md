# Deploying abCV

## Prerequisites

- Node.js 22+, pnpm 10+ (the project targets pnpm 10, which requires Node 22)
- PostgreSQL 17+ (managed or self-hosted)
- AWS credentials with `cognito-idp:*` (or use the default credential chain — `~/.aws/credentials`, `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`, or an EC2/ECS role). The server signs Cognito IDP calls (signUp/confirmSignUp/initiateAuth) with these.
- OpenCode Go API key for LLM features (mock mode works without it)
- A host that can run Puppeteer (`--no-sandbox`) — Render, Fly.io, Railway, or a VM. **Not** Vercel serverless (Puppeteer needs a full Chrome binary).

## 1. Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXTAUTH_URL` | No | Public URL (reserved; unused by the own-UI flow) |
| `NEXTAUTH_SECRET` | No | Reserved (kept for back-compat; the own-UI flow doesn't sign state) |
| `COGNITO_REGION` | Yes | AWS region of the User Pool (e.g. `us-east-1`); also used by the IDP SDK client |
| `COGNITO_USER_POOL_ID` | Yes | e.g. `us-east-1_XXXXXXXXX` |
| `COGNITO_CLIENT_ID` | Yes | App client id (confidential client, `USER_PASSWORD_AUTH` enabled) |
| `COGNITO_CLIENT_SECRET` | Yes | App client secret (used to compute `SECRET_HASH` and revoke tokens) |
| `COGNITO_DOMAIN` | Yes | Cognito domain, e.g. `abcv-auth.auth.us-east-1.amazoncognito.com` (used for token refresh + revocation) |
| `COGNITO_REDIRECT_URI` | No | Hosted-UI only (unused by the own-UI flow) |
| `COGNITO_LOGOUT_URI` | No | Hosted-UI only (unused by the own-UI flow) |
| `COGNITO_TOKEN_VALIDITY_DAYS` | No | Cookie max-age in days (default `30`, matches Cognito refresh-token validity) |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | (or role) | If not using `~/.aws/credentials` or an instance role. Any valid AWS creds work — the Cognito client-side ops aren't IAM-gated, but the SDK needs creds to sign. |
| `OPENCODE_GO_API_KEY` | No | Get one at https://opencode.ai/auth; without it the app uses mock data |
| `OPENCODE_GO_BASE_URL` | No | Default: `https://opencode.ai/zen/go/v1` |
| `OPENCODE_GO_MODEL` | No | Default: `deepseek-v4-flash` |
| `RESEND_API_KEY` | No | Transactional email (welcome CV email). Without it, the welcome email is skipped |

Photos are stored as base64 in the database — no file storage or S3 needed.

### Provisioning Cognito (one-time)

```bash
REGION=us-east-1
# 1. User Pool (email usernames, auto-verified email, 8+ char password)
POOL=$(aws cognito-idp create-user-pool \
  --pool-name abcv \
  --username-attributes email \
  --auto-verified-attributes email \
  --schema '[{"Name":"email","Required":true,"Mutable":true},{"Name":"name","Required":true,"Mutable":true}]' \
  --policies '{"PasswordPolicy":{"MinimumLength":8,"RequireUppercase":true,"RequireLowercase":true,"RequireNumbers":true,"RequireSymbols":false,"TemporaryPasswordValidityDays":7}}' \
  --email-configuration '{"EmailSendingAccount":"COGNITO_DEFAULT"}' \
  --account-recovery-setting '{"RecoveryMechanisms":[{"Name":"verified_email","Priority":1}]}' \
  --region $REGION --query 'UserPool.Id' --output text)
echo "POOL=$POOL"

# 2. Confidential app client with Hosted UI (OAuth authorization-code flow)
CLIENT=$(aws cognito-idp create-user-pool-client \
  --user-pool-id $POOL --client-name abcv-web --generate-secret \
  --callback-urls '["https://your-app.com/api/auth/callback/cognito"]' \
  --logout-urls '["https://your-app.com/login"]' \
  --default-redirect-uri "https://your-app.com/api/auth/callback/cognito" \
  --allowed-o-auth-flows "code" --allowed-o-auth-scopes "openid" "email" "profile" \
  --supported-identity-providers "COGNITO" \
  --explicit-auth-flows "ALLOW_USER_PASSWORD_AUTH" "ALLOW_REFRESH_TOKEN_AUTH" \
  --refresh-token-validity 30 --access-token-validity 1 --id-token-validity 1 \
  --region $REGION --query 'UserPoolClient.ClientId' --output text)
SECRET=$(aws cognito-idp describe-user-pool-client --user-pool-id $POOL --client-id $CLIENT \
  --region $REGION --query 'UserPoolClient.ClientSecret' --output text)
echo "CLIENT=$CLIENT SECRET=$SECRET"

# 3. Hosted UI domain (globally unique per region)
aws cognito-idp create-user-pool-domain --domain abcv-auth --user-pool-id $POOL --region $REGION
```

The JWKS URL used to verify ID tokens is
`https://cognito-idp.<region>.amazonaws.com/<pool-id>/.well-known/jwks.json`.

The own-UI auth flow uses `USER_PASSWORD_AUTH` (enabled via `--explicit-auth-flows
ALLOW_USER_PASSWORD_AUTH`) with a `SECRET_HASH` = `base64(HMAC_SHA256(clientSecret,
username + clientId))`, computed server-side. The Hosted-UI callback/logout URLs
in step 2 are only needed if you later add a Hosted-UI branch.

## 2. Database

```bash
# Create the database
createdb abcv

# Apply migrations
DATABASE_URL="postgresql://..." pnpm prisma migrate deploy

# Or, if you prefer to push the schema directly:
DATABASE_URL="postgresql://..." pnpm prisma db push
```

## 3. Build & start

```bash
pnpm install
pnpm build

# Start the production server
pnpm start
# → http://localhost:3000
```

## 4. Deploy guides

### Docker

A `Dockerfile` is not yet included. You can build one from the `standalone` output:

```bash
pnpm build
# .next/standalone/ contains a self-contained Node server
# Copy it + public/ + templates/ + .env to your target host
```

### Render (recommended)

1. Create a **Web Service** → connect your repo
2. Build command: `pnpm install && pnpm build`
3. Start command: `pnpm start`
4. Add a PostgreSQL database via Render Dashboard
5. Set `NODE_VERSION` to `20` in environment
6. Puppeteer requires the `--no-sandbox` arg (already set in `pdf.ts`); Render supports it out of the box

### Fly.io

```bash
fly launch
fly postgres create
fly secrets set DATABASE_URL="..." NEXTAUTH_SECRET="..."
fly deploy
```

### Railway

1. Connect repo
2. Add `DATABASE_URL` from Railway PostgreSQL plugin
3. Build: `pnpm install && pnpm build`
4. Start: `pnpm start`
5. Puppeteer works with `--no-sandbox` on Railway

## 5. Post-deploy

```bash
# Apply any pending migrations
pnpm prisma migrate deploy

# Verify the app is healthy
curl https://your-app.com/api/templates
# → should return the template list
```

## 6. Production considerations

- **Auth**: AWS Cognito backs the full lifecycle. The app uses its **own** styled UI (no Hosted UI) driving the Cognito IDP APIs server-side: `signUp` (creates an UNCONFIRMED user; Cognito emails a 6-digit code) → `confirmSignUp` (validates the code) → `initiateAuth` (`USER_PASSWORD_AUTH` + `SECRET_HASH`) → Cognito ID/Access/Refresh tokens stored in httpOnly cookies, verified (RS256) against the Cognito JWKS on every protected request. Sign-out revokes the refresh token. For social login, add a Hosted-UI branch; for production rate-limiting, front the app with CloudFront + WAF.
- **Puppeteer**: Runs headless Chrome per request (~150-300ms cold start). For high throughput, consider a persistent browser pool or an external PDF service.
- **LLM cost**: Each CV generation costs ~1,500 tokens. The DeepSeek V4 Flash model via OpenCode Go is ~$0.15/1M tokens — roughly $0.002 per CV.
- **Scaling**: The app is stateless (everything in Postgres). Scale horizontally behind a load balancer.
