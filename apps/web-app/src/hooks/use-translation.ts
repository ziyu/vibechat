'use client'

import { useRouteContext } from '@tanstack/react-router'
import { translations, type SupportedLocale, locales, type Translations } from '@vibechat/i18n'
import { createNextTranslationFunction } from '@vibechat/validators'
import { config } from '@config'
import { setClientLocalePreference } from '@/lib/locale.functions'

export function useTranslation() {
  const { locale } = useRouteContext({ from: '__root__' })
  const t = translations[locale] as Translations

  const tWithParams = createNextTranslationFunction(t)

  const changeLocale = (newLocale: SupportedLocale) => {
    if (newLocale === locale) return
    setClientLocalePreference(newLocale)
    window.location.reload()
  }

  return {
    t,
    tWithParams,
    locale,
    locales,
    defaultLocale: config.app.i18n.defaultLocale,
    changeLocale,
    isDefaultLocale: locale === config.app.i18n.defaultLocale,
  } as const
}
