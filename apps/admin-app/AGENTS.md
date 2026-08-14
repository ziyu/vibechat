# AGENTS.md

## Overview

`apps/admin-app` is VibeChat's internal operations host. It owns user, subscription, order, credits, pricing, Blog, commission and withdrawal management. Future atmosphere review is added here as a module.

## Commands

```bash
pnpm dev:admin
pnpm --dir apps/admin-app typecheck
pnpm --dir apps/admin-app build
```

Local port: `8005`.

Canonical page routes are locale-neutral (`/admin`, `/signin`, `/forbidden`). The root route resolves `VIBECHAT_LOCALE` during SSR; `/en/**` and `/zh-CN/**` are legacy redirect boundaries only and must not be used for new navigation.

## Boundaries

- Consume operations data only through the Backend `/api/*` gateway.
- Do not import database, Better Auth server, storage, provider SDKs, Backend domain services or another app.
- Every route uses the Admin session guard; Backend authorization remains mandatory on every API handler.
- Browser-safe HTTP shapes belong in `@vibechat/api-contracts`; Better Auth browser operations use `@vibechat/auth-client`.
- User-visible text uses i18n keys, with English updated before Chinese.
