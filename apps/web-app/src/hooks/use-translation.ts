'use client'

import { useRouteContext } from '@tanstack/react-router'
import { translations, type SupportedLocale, locales, type Translations } from '@libs/i18n'
import { createNextTranslationFunction } from '@libs/validators'
import { config } from '@config'
import { setLocalePreference } from '@/lib/locale.functions'

export function useTranslation() {
  const { locale } = useRouteContext({ from: '__root__' })
  const t = translations[locale] as Translations

  const tWithParams = createNextTranslationFunction(t)

  const changeLocale = async (newLocale: SupportedLocale) => {
    if (newLocale === locale) return
    await setLocalePreference({ data: newLocale })
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
