# cssberlin.de - Multi-stage Dockerfile
# Stage 1: Install dependencies
# Stage 2: Build application
# Stage 3: Operations runner for Prisma tasks
# Stage 4: Production runner

FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma/

RUN npm install --ignore-scripts
RUN npx prisma generate

FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/src/generated ./src/generated
COPY . .

ARG NEXT_PUBLIC_APP_URL=https://cssberlin.de
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""
ARG NEXT_PUBLIC_PUSHER_KEY=""
ARG NEXT_PUBLIC_PUSHER_CLUSTER=eu

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV NEXTAUTH_SECRET="build-time-secret-placeholder-32chars"

RUN npm run build

FROM node:20-alpine AS ops
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/src/generated ./src/generated
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/ops ./ops
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json

# node:20-alpine ships OpenSSL 3.x, but the schema-engine binary that ships
# in @prisma/engines for this version is built against OpenSSL 1.1 (which
# Alpine no longer packages at all). Replace it with the official
# openssl-3.0.x build from Prisma's own CDN, pinned to this exact engines
# hash (matches `prisma -v` -> "Default Engines Hash").
RUN wget -qO /app/schema-engine.gz \
      https://binaries.prisma.sh/all_commits/605197351a3c8bdd595af2d2a9bc3025bca48ea2/linux-musl-openssl-3.0.x/schema-engine.gz \
    && gunzip /app/schema-engine.gz \
    && chmod +x /app/schema-engine
ENV PRISMA_SCHEMA_ENGINE_BINARY=/app/schema-engine

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

CMD ["node", "server.js"]