import { translations, type SupportedLocale, type Translations } from '@libs/i18n'

interface HeadConfig {
  meta: Array<{ title: string } | { name: string; content: string }>
}

/**
 * Resolve translations for route `head()` functions, which run outside React
 * component context but receive the request locale through root route context.
 */
export function getTranslations(locale: SupportedLocale): Translations {
  return translations[locale] as Translations
}

/**
 * Build a TanStack Router `head()` return value from i18n metadata keys.
 */
export function seoHead(
  locale: SupportedLocale,
  extract: (t: Translations) => { title: string; description?: string; keywords?: string },
): HeadConfig {
  const t = getTranslations(locale)
  const seo = extract(t)
  const meta: HeadConfig['meta'] = [{ title: seo.title }]
  if (seo.description) meta.push({ name: 'description', content: seo.description })
  if (seo.keywords) meta.push({ name: 'keywords', content: seo.keywords })
  return { meta }
}
