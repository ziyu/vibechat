# AGENTS.md

## Overview

`apps/web-app` is the VibeChat product Web/PWA host. It owns authentication UI, onboarding, chat routes, Matrix browser runtime composition, and a thin same-origin gateway to `apps/backend`.

It does not own the public site, product API business handlers, database access, payment/AI legacy pages, or the future Desktop host.

## Commands

```bash
# From repository root: backend + Web + site
pnpm dev

# Backend + Web only
pnpm dev:web

# Product host checks
pnpm --dir apps/web-app typecheck
pnpm --dir apps/web-app build
```

The product Web runs on `8001`. The shared backend runs on `8002`; local Vite and the production catch-all gateway keep browser requests on the public Web origin.

## Active Routes

```text
src/routes/
├── __root.tsx
├── index.tsx                    # / -> localized product entry
├── $lang.tsx
├── $lang/(auth)/*               # signin/signup/OTP/reset
├── $lang/(chat)/*               # messages/rooms/contacts/discover/me
├── $lang/onboarding.tsx
├── $lang/(root)/index.tsx       # localized root -> messages
├── api/$.ts                     # same-origin backend gateway only
└── v1/$.ts                      # same-origin backend gateway only
```

Old SaaS pages and components live under `legacy/web-app` and are not part of the route tree.

## Boundaries

- Page and chat composition may import browser-safe shared UI, i18n, validators, contracts, and `@libs/auth/authClient`.
- Do not import `@libs/database`, `@libs/payment`, `@libs/credits`, `@libs/ai`, `@libs/storage`, server Auth, or another app.
- `src/lib/backend-proxy.ts` may only forward requests. Business parsing, authorization, persistence, and provider calls belong in `apps/backend` or shared domain libraries.
- Browser-safe configuration resolves through `config/public.ts`.
- Run `pnpm boundaries:check` after changing imports or app composition.

## Product Rules

- User-visible text uses i18n keys, updating English and Chinese together.
- All product routes need authentication and resource ownership checks at both page and backend layers.
- Real Matrix and server state remain authoritative; never add fixture fallbacks to authenticated flows.
- Validate affected UI in the running app and run the matching specs from `tests/e2e/specs`.

## Troubleshooting

- A `401` from `/v1/*` usually means the backend is reachable but no Better Auth Cookie exists.
- A gateway `fetch failed` usually means `apps/backend` is not running on `BACKEND_ORIGIN`.
- Route type errors after moving files require regenerating `src/routeTree.gen.ts` by running Vite build/dev.
- Backend Cloudflare issues belong to [`../backend/CF-NOTES.md`](../backend/CF-NOTES.md).
