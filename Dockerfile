# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# 1. Abhängigkeiten installieren + Prisma Client generieren
FROM base AS deps
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

# 2. Next.js Production Build (Standalone)
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_APP_URL=https://throwoff.app
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

# Platzhalter-URL nur für Next.js Build-Analyse (keine DB-Verbindung beim Build)
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" npm run build

# 3. Tooling- & Worker-Target (Prisma Migrations, Seeding, pg-boss Liga-Sync-Worker)
FROM base AS worker
ENV NODE_ENV=production
# Source files come from the checkout with owner-only modes; the node user must
# be able to read them (Prisma CLI loads prisma.config.ts at runtime).
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json prisma.config.ts tsconfig.json ./
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node src ./src
USER node
CMD ["npm", "run", "worker"]

# 4. Schlanke Standalone-Runtime für die Web-App (Default-Target)
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
