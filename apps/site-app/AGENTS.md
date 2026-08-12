# AGENTS.md

## Overview

`apps/site-app` is the public VibeChat site. It owns the localized homepage, public Blog presentation, SEO, and explicit links to the product Web origin.

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
- Product links use `VITE_WEB_APP_ORIGIN` and preserve the active locale.
- Blog gateway routes may only forward public reads to `BACKEND_ORIGIN`.
- User-visible text uses existing i18n keys; update English and Chinese together for new content.
