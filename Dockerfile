# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Base : Node 22 + pnpm via corepack
# ---------------------------------------------------------------------------
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ---------------------------------------------------------------------------
# deps : installation complète (dev incluses, nécessaires pour le build)
# ---------------------------------------------------------------------------
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# builder : Prisma Client + build Next.js (standalone)
# ---------------------------------------------------------------------------
FROM base AS builder
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Valeurs factices, en ARG (non persistées dans l'image, contrairement à ENV) :
# `prisma generate` et `next build` évaluent la config/les modules serveur
# (dont `src/lib/db.ts`, `src/auth.ts`) sans jamais se connecter réellement —
# seule leur simple présence est requise pour que ces modules s'initialisent.
# Les vraies valeurs sont injectées au runtime (docker-compose*.yml).
ARG DATABASE_URL="mysql://build:build@localhost:3306/build"
ARG AUTH_SECRET="build-time-placeholder-not-used-at-runtime"
ARG MAGIC_LINK_SECRET="build-time-placeholder-not-used-at-runtime"
ARG BADGE_HMAC_SECRET="build-time-placeholder-not-used-at-runtime"
RUN pnpm prisma generate
RUN pnpm build

# ---------------------------------------------------------------------------
# runner : image de production minimale
# ---------------------------------------------------------------------------
FROM base AS runner
# Chromium système + polices : le rendu des badges (PDF/PNG) passe par
# `puppeteer-core`, qui n'embarque aucun navigateur. Le Chromium livré par le
# paquet `puppeteer` est lié à la glibc et ne s'exécute pas sur Alpine — d'où
# le paquet système. `ttf-freefont` est indispensable : sans police, le badge
# se rend en carrés vides.
RUN apk add --no-cache   openssl   chromium   nss   freetype   harfbuzz   ca-certificates   ttf-freefont
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

RUN mkdir -p /app/storage && chown nextjs:nodejs /app/storage
VOLUME ["/app/storage"]

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
