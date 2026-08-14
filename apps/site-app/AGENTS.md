# AGENTS.md

## Overview

`apps/site-app` is the public VibeChat site. It owns the translated homepage, public Blog presentation, SEO, and explicit links to the product Web origin.

## Commands

```bash
pnpm dev:site
pnpm --dir apps/site-app typecheck
pnpm --dir apps/site-app build
```

Local port: `8003`.

## Boundaries

- Do not import Matrix, Better Auth server/client, database, product stores, payment, AI, storage providers, or another app.
- Public configuration resolves through `config/public.ts`.
- Public URLs are locale-neutral. The root route resolves `VIBECHAT_LOCALE` during SSR, and language switching keeps pathname, search, and hash unchanged.
- Product links use `VITE_WEB_APP_ORIGIN` without adding a locale path segment.
- `/en/**` and `/zh-CN/**` are legacy redirect boundaries only; new routes and navigation must not depend on `$locale`.
- Blog gateway routes may only forward public reads to `BACKEND_ORIGIN`.
- User-visible text uses existing i18n keys; update English and Chinese together for new content.
