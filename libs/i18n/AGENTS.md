# AGENTS.md

## Overview

`libs/i18n` is the framework-agnostic translation catalog for the VibeChat product application. The current product runtime is `apps/web-app` (TanStack Start); the Fumadocs documentation site owns its content-localization routing separately.

## Source of truth

- Supported locales and the default locale come from `config.app.i18n`.
- `locales/en.ts` defines the TypeScript translation shape.
- `locales/zh-CN.ts` must keep the same structure as English.
- `index.ts` exposes locale validation, normalization, labels, catalogs, and types.

## Product routing contract

- Product URLs are canonical business paths such as `/`, `/signin`, and `/dashboard`; locale is never a product route parameter.
- `apps/web-app/src/lib/locale.functions.ts` resolves request locale in this order: valid locale Cookie, optional `Accept-Language` detection, default locale.
- `apps/web-app/src/routes/__root.tsx` places the resolved locale in root route context and sets `<html lang>` during SSR.
- `apps/web-app/src/hooks/use-translation.ts` is the component API. Changing locale updates the Cookie and reloads the same URL.
- `apps/web-app/src/routes/$locale/**` exists only for legacy-link compatibility. It accepts an exact supported locale, writes the Cookie, and redirects to the locale-neutral canonical path.

Do not add locale path parameters, locale-aware link builders, or client-only language detection to product pages.

## Adding or changing translations

1. Add the key to `locales/en.ts` first.
2. Add the same key and shape to `locales/zh-CN.ts`.
3. Render it through `useTranslation()` or the request locale supplied to route metadata.
4. Run `pnpm typecheck` and the affected E2E tests.

Keep translation keys in `camelCase`, avoid nesting deeper than four levels, and do not hard-code user-visible fallback text in components.

## Locale semantics

Locale controls interface language and localized content selection. It does not authorize purchases, select a billing market, determine currency, or replace timezone. Those concerns require explicit domain data and validation.

## Verification

- Both locale files have matching types.
- Canonical URLs do not change when language changes.
- Cookie language is correct on SSR and after hydration.
- Unknown locale-like paths remain 404.
- Legacy `en` and `zh-CN` links redirect once and preserve path, query, and hash.
