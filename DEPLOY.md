# Deploying abCV

## Prerequisites

- Node.js 20+, pnpm
- PostgreSQL 17 (managed or self-hosted)
- OpenCode Go API key for LLM features (mock mode works without it)
- A host that can run Puppeteer (`--no-sandbox`) — Render, Fly.io, Railway, or a VM. **Not** Vercel serverless (Puppeteer needs a full Chrome binary).

## 1. Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXTAUTH_URL` | Yes | Public URL of your deployment; used to build Cognito callback/logout URLs |
| `NEXTAUTH_SECRET` | Yes | Random string; signs the OAuth `state` cookie (CSRF). Generate with `openssl rand -base64 48` |
| `COGNITO_REGION` | Yes | AWS region of the User Pool (e.g. `us-east-1`) |
| `COGNITO_USER_POOL_ID` | Yes | e.g. `us-east-1_XXXXXXXXX` |
| `COGNITO_CLIENT_ID` | Yes | App client id (confidential client with OAuth code flow) |
| `COGNITO_CLIENT_SECRET` | Yes | App client secret (generated) |
| `COGNITO_DOMAIN` | Yes | Hosted UI domain, e.g. `abcv-auth.auth.us-east-1.amazoncognito.com` |
| `COGNITO_REDIRECT_URI` | Yes | `https://your-app.com/api/auth/callback/cognito` (must match the App Client's callback URL) |
| `COGNITO_LOGOUT_URI` | Yes | `https://your-app.com/login` (must match the App Client's logout URL) |
| `COGNITO_TOKEN_VALIDITY_DAYS` | No | Cookie max-age in days (default `30`, matches Cognito refresh-token validity) |
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

- **Auth**: AWS Cognito Hosted UI handles sign-up, sign-in, email verification, and password reset out of the box. The app stores Cognito ID/Access/Refresh tokens in httpOnly cookies and verifies the ID token (RS256) against the Cognito JWKS on every protected request. For social login, attach a Google/etc. identity provider to the User Pool; for production rate-limiting, front the app with CloudFront + WAF.
- **Puppeteer**: Runs headless Chrome per request (~150-300ms cold start). For high throughput, consider a persistent browser pool or an external PDF service.
- **LLM cost**: Each CV generation costs ~1,500 tokens. The DeepSeek V4 Flash model via OpenCode Go is ~$0.15/1M tokens — roughly $0.002 per CV.
- **Scaling**: The app is stateless (everything in Postgres). Scale horizontally behind a load balancer.
