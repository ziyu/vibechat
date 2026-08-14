# AGENTS.md

## Overview

`apps/web-app` is the single VibeChat product application. It uses TanStack Start, TanStack Router, React, Vite, and a Cloudflare Workers production target. Shared domain behavior belongs in `libs/*`; static options and defaults belong in `config/*` or `config.ts`.

## Setup commands

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm build
```

Cloudflare-specific commands:

```bash
pnpm --dir apps/web-app dev:cf
pnpm --dir apps/web-app preview:cf
```

## Route and localization contract

- Product routes use locale-neutral canonical URLs. Examples: `/`, `/signin`, `/dashboard`, `/admin`.
- Route groups are `src/routes/(root)`, `src/routes/(auth)`, and `src/routes/admin`.
- `src/routes/api` contains raw HTTP endpoints, auth handlers, uploads, webhooks, and other APIs.
- Never add a locale parameter to a product route or pass locale through `Link`/`navigate` params.
- `src/routes/__root.tsx` resolves the request locale and exposes it through root route context.
- Components use `src/hooks/use-translation.ts`; route metadata uses `match.context.locale`.
- `src/routes/$locale` and its splat child are a legacy-link compatibility boundary only. They must not render product pages.
- Locale controls interface language. Do not use it as purchase authorization, market, currency, country, or timezone.

## Directory structure

```text
apps/web-app/src/
├── routes/
│   ├── __root.tsx          # request locale, providers, document shell
│   ├── (root)/             # public and signed-in product pages
│   ├── (auth)/             # signin, signup, recovery
│   ├── admin.tsx           # admin layout route
│   ├── admin/              # admin pages
│   ├── $locale.tsx         # exact legacy locale validation + redirect
│   ├── $locale/$.tsx       # legacy deep-link catch-all
│   └── api/                # server API routes
├── components/             # product-specific React components
├── hooks/                  # product hooks, including useTranslation
├── lib/                    # route guards and server adapters
├── router.tsx
└── routeTree.gen.ts        # generated; do not edit by hand
```

## Adding a page

```tsx
// src/routes/(root)/my-page.tsx
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from '@/hooks/use-translation'

export const Route = createFileRoute('/(root)/my-page')({
  head: ({ match }) => seoHead(match.context.locale, (t) => t.myPage.metadata),
  component: MyPage,
})

function MyPage() {
  const { t } = useTranslation()
  return <h1>{t.myPage.title}</h1>
}
```

Protected pages call the appropriate guard from `src/lib/auth-guard.ts` in `beforeLoad`. API routes must independently authenticate and authorize requests; page guards are not an API security boundary.

## Server boundaries

- Use `createServerFn` for typed page RPC and request adapters.
- Use `src/routes/api/**` for raw HTTP contracts, uploads, authentication handlers, and provider callbacks.
- Keep reusable business and provider logic in `libs/*`.
- Validate inputs and preserve stable response shapes.
- Cloudflare database access uses the repository's request-scoped DB helpers.

## Verification

For code or configuration changes run, from the repository root:

```bash
pnpm docs:check
pnpm typecheck
pnpm build
```

Run relevant Playwright scenarios after checking the actual DOM in the running app. Server or shared-library changes must also be exercised against the Cloudflare preview as described in `CF-NOTES.md`.

## Troubleshooting

- Route 404: check the route group and generated `routeTree.gen.ts`; do not add a language segment to make a page match.
- Incorrect language: inspect `VIBECHAT_LOCALE`, `config.app.i18n`, root route context, and SSR `<html lang>`.
- Shared component import errors: shared React code must not depend on framework-specific modules.
- Cloudflare failures: follow `CF-NOTES.md` and the deployment Runbook.
