import { config } from '@config'
import { translations, type SupportedLocale, type Translations } from '@vibechat/i18n'

export function getTranslations(lang: string): Translations {
  const locale = lang as SupportedLocale
  return (translations[locale] || translations[config.app.i18n.defaultLocale]) as Translations
}

export function seoHead(
  lang: string,
  extract: (translations: Translations) => { title: string; description?: string },
) {
  const seo = extract(getTranslations(lang))
  return {
    meta: [
      { title: seo.title },
      ...(seo.description ? [{ name: 'description', content: seo.description }] : []),
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }
}
