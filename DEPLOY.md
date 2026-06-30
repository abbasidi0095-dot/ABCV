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
| `NEXTAUTH_SECRET` | Yes | Random string for session encryption |
| `NEXTAUTH_URL` | Yes | Public URL of your deployment |
| `OPENCODE_GO_API_KEY` | No | Get one at https://opencode.ai/auth; without it the app uses mock data |
| `OPENCODE_GO_BASE_URL` | No | Default: `https://opencode.ai/zen/go/v1` |
| `OPENCODE_GO_MODEL` | No | Default: `deepseek-v4-flash` |

Photos are stored as base64 in the database — no file storage or S3 needed.

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

- **Auth**: The default `CredentialsProvider` auto-creates accounts on login. Add OAuth, email verification, or rate-limiting before opening to the public.
- **Puppeteer**: Runs headless Chrome per request (~150-300ms cold start). For high throughput, consider a persistent browser pool or an external PDF service.
- **LLM cost**: Each CV generation costs ~1,500 tokens. The DeepSeek V4 Flash model via OpenCode Go is ~$0.15/1M tokens — roughly $0.002 per CV.
- **Scaling**: The app is stateless (everything in Postgres). Scale horizontally behind a load balancer.
