# AGENTS.md

## Overview

`apps/backend` is the shared VibeChat backend and the only active owner of Better Auth HTTP handlers, product `/v1` routes, product uploads, database health, public Blog reads, and internal Admin APIs.

## Commands

```bash
pnpm dev:backend
pnpm --dir apps/backend typecheck
pnpm --dir apps/backend build:node
pnpm --dir apps/backend build:cf
pnpm --dir apps/backend preview:cf
```

Local port: `8002`. Browser traffic normally reaches it through the Web `8001` same-origin gateway.

## Boundaries

- HTTP routes parse and validate requests with `@vibechat/api-contracts`, call `libs/*` Backend domain services, and shape responses.
- Do not import React product screens or another app.
- Every user/resource route independently verifies session, permission, and ownership.
- Every `/api/admin/*` route uses the shared Admin authorization boundary and returns `401` for missing sessions and `403` for authenticated non-admin users.
- Preserve public `/api/auth/*`, `/api/upload`, and `/v1/*` response and Cookie contracts.
- Request-scoped database bindings go through `src/lib/with-request-db.ts`.
- Cloudflare changes follow [`CF-NOTES.md`](./CF-NOTES.md) and the deployment Runbook.

Payment, AI, affiliate, credit, pricing and account APIs are active Backend responsibilities. Keep provider SDKs and database mutations inside Backend-owned `libs/*`; Web and Admin only consume the HTTP contracts.
