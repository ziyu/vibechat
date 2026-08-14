# VibeChat internationalization library

`libs/i18n` contains the type-safe translation catalogs shared by the product application. The supported locales are currently `zh-CN` and `en`; `config.app.i18n` in the root `config.ts` is the configuration source of truth.

## Current architecture

The product uses locale-neutral canonical URLs such as `/`, `/signin`, and `/dashboard`. Locale is a request preference, not part of a resource identity.

Resolution order:

1. a valid `VIBECHAT_LOCALE` cookie;
2. `Accept-Language` when `autoDetect=true`;
3. `defaultLocale`.

The TanStack root route resolves locale during SSR, puts it in route context, and sets `<html lang>`. Components read that same context through `apps/web-app/src/hooks/use-translation.ts`, keeping the initial response and hydration consistent. Changing language updates the cookie and reloads the current URL without changing its path, query, or hash.

Legacy `/en/**` and `/zh-CN/**` links are compatibility inputs only. The server validates the locale, writes the preference, and returns a 307 redirect to the locale-neutral canonical path. Unknown paths such as `/fr/**` are not guessed or redirected.

The documentation site is content-oriented and may maintain its own localized content URLs; it does not share the product-routing contract.

## Usage

```tsx
import { useTranslation } from '@/hooks/use-translation'

function Example() {
  const { t, locale, changeLocale } = useTranslation()

  return (
    <>
      <h1>{t.header.navigation.ai}</h1>
      <button onClick={() => changeLocale(locale === 'en' ? 'zh-CN' : 'en')}>
        Switch
      </button>
    </>
  )
}
```

Framework-independent code can use the catalog directly:

```ts
import { getTranslation, normalizeLocale, type SupportedLocale } from '@libs/i18n'

const locale: SupportedLocale = normalizeLocale(input) ?? 'zh-CN'
const t = getTranslation(locale)
```

## Adding copy or locales

Add translation keys to `locales/en.ts` first, then mirror the same shape in `locales/zh-CN.ts`. The English catalog defines the translation type.

Adding a locale also requires updates to:

- `config.app.i18n.locales` and any default;
- the locale file and `translations` map;
- `localeLabels`;
- request resolution, legacy compatibility, and E2E coverage.

Locale controls UI language only. Market, currency, payment eligibility, and timezone require separate domain fields and server-side rules.
