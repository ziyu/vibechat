'use client'

import { useRouteContext } from '@tanstack/react-router'
import { config } from '@config'
import { locales, translations, type SupportedLocale, type Translations } from '@vibechat/i18n'
import { createNextTranslationFunction } from '@vibechat/validators'
import { setClientLocalePreference } from '@/lib/locale.functions'

export function useTranslation() {
  const { locale } = useRouteContext({ from: '__root__' })
  const t = translations[locale] as Translations

  return {
    t,
    tWithParams: createNextTranslationFunction(t),
    locale,
    locales,
    defaultLocale: config.app.i18n.defaultLocale,
    isDefaultLocale: locale === config.app.i18n.defaultLocale,
    changeLocale(newLocale: SupportedLocale) {
      if (newLocale === locale) return
      setClientLocalePreference(newLocale)
      window.location.reload()
    },
  } as const
}
