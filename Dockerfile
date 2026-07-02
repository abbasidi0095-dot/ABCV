FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

FROM base AS deps
WORKDIR /app
# Let puppeteer download its own matching Chrome into a known cache dir.
ENV PUPPETEER_CACHE_DIR=/app/.puppeteer-cache
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
RUN apt-get update && apt-get install -y openssl --no-install-recommends && rm -rf /var/lib/apt/lists/*

FROM base AS builder
WORKDIR /app
ENV PUPPETEER_CACHE_DIR=/app/.puppeteer-cache
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/.puppeteer-cache /app/.puppeteer-cache
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN pnpm build
RUN cp -r $(find /app/node_modules/.pnpm -path "*/node_modules/.prisma" -type d | head -1) /app/prisma-client-bin
# Flatten the downloaded puppeteer Chrome to a stable path the runner can use.
RUN mkdir -p /app/chrome-bin && \
    cp "$(find /app/.puppeteer-cache -type f -name chrome -path '*chrome-linux64*' | head -1)" /app/chrome-bin/chrome && \
    chmod +x /app/chrome-bin/chrome
# Copy complete puppeteer packages from builder's pnpm store (standalone output is incomplete)
RUN mkdir -p /app/puppeteer-store/.pnpm && \
    for entry in puppeteer@23.11.1 puppeteer-core@23.11.1 @puppeteer+browsers@2.6.1; do \
      dir=$(find /app/node_modules/.pnpm -maxdepth 1 -name "${entry}*" -type d | head -1); \
      if [ -n "$dir" ]; then \
        cp -r "$dir" "/app/puppeteer-store/.pnpm/$(basename "$dir")"; \
      fi; \
    done

FROM base AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y \
  chromium \
  fonts-liberation \
  fonts-noto-color-emoji \
  openssl \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# Install Prisma CLI for migrations (runs at deploy time)
RUN npm install -g prisma@6.19.3

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PUPPETEER_SKIP_DOWNLOAD=true
# Use the puppeteer-bundled Chrome (version-matched) instead of Debian chromium,
# whose crashpad handler fails to launch in minimal containers.
ENV PUPPETEER_EXECUTABLE_PATH=/app/chrome-bin/chrome
ENV CHROME_BIN=/app/chrome-bin/chrome

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/templates ./templates
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma-client-bin ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/chrome-bin /app/chrome-bin
# Replace incomplete puppeteer pnpm store entries with complete copies from builder
RUN for entry in puppeteer@23.11.1 puppeteer-core@23.11.1 @puppeteer+browsers@2.6.1; do \
      dir=$(find /app/node_modules/.pnpm -maxdepth 1 -name "${entry}*" -type d | head -1); \
      if [ -n "$dir" ]; then \
        rm -rf "$dir"; \
      fi; \
    done
COPY --from=builder /app/puppeteer-store/.pnpm/ /app/node_modules/.pnpm/
# Create symlinks for puppeteer packages from replaced pnpm store entries
RUN mkdir -p /app/node_modules/@puppeteer && \
    ln -sfn /app/node_modules/.pnpm/puppeteer@23.11.1_typescript@5.9.3/node_modules/puppeteer /app/node_modules/puppeteer && \
    ln -sfn /app/node_modules/.pnpm/puppeteer-core@23.11.1/node_modules/puppeteer-core /app/node_modules/puppeteer-core && \
    ln -sfn /app/node_modules/.pnpm/@puppeteer+browsers@2.6.1/node_modules/@puppeteer/browsers /app/node_modules/@puppeteer/browsers
# Ensure the runtime user can write browser temp/profile data.
RUN mkdir -p /tmp/puppeteer-ud && chown -R nextjs:nodejs /tmp/puppeteer-ud && chmod 1777 /tmp

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --chmod=755 <<'START_SCRIPT' /app/start.sh
#!/bin/sh
echo "[start.sh] Running database migrations..."
npx prisma migrate deploy 2>&1 || echo "[start.sh] Migration failed, continuing anyway..."
echo "[start.sh] Starting application..."
exec node server.js
START_SCRIPT

CMD ["/app/start.sh"]