import { config } from '@config'
import { translations, type SupportedLocale, type Translations } from '@vibechat/i18n'

export function getTranslations(locale: SupportedLocale): Translations {
  return (translations[locale] || translations[config.app.i18n.defaultLocale]) as Translations
}

export function seoHead(
  locale: SupportedLocale,
  extract: (translations: Translations) => { title: string; description?: string },
) {
  const seo = extract(getTranslations(locale))
  return {
    meta: [
      { title: seo.title },
      ...(seo.description ? [{ name: 'description', content: seo.description }] : []),
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }
}
