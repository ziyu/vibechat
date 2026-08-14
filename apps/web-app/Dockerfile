# TanStack Start Production Dockerfile (Nitro)
FROM node:22-alpine AS base

# Build stage
FROM base AS builder
RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.4.0 --activate

# Copy all files needed for build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json config.ts tsconfig.json .npmrc ./
COPY config ./config
COPY apps/web-app ./apps/web-app
COPY packages ./packages
COPY libs ./libs
COPY scripts ./scripts

ARG NODE_OPTIONS="--max-old-space-size=6144"

ENV BUILD_TIME=true
ENV NODE_OPTIONS=${NODE_OPTIONS}

# Install dependencies
RUN pnpm install --frozen-lockfile
# Build with Nitro (produces self-contained .output/)
RUN pnpm --filter @vibechat/web-app run build:node

# Production image
FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser

# Copy Nitro output (self-contained, no node_modules needed)
COPY --from=builder /app/apps/web-app/.output ./.output

# SQLite support: create data directory for DB_DIALECT=sqlite
RUN mkdir -p /app/data

RUN chown -R appuser:nodejs /app
USER appuser

EXPOSE 8001

ENV PORT=8001
ENV NODE_ENV=production
ENV HOST=0.0.0.0

CMD ["node", ".output/server/index.mjs"]
