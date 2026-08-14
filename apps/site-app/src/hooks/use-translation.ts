'use client'

import { useRouteContext } from '@tanstack/react-router'
import {
  locales,
  translations,
  type SupportedLocale,
  type Translations,
} from '@vibechat/i18n'
import { createNextTranslationFunction } from '@vibechat/validators'
import { config } from '@config'
import { setClientLocalePreference } from '@/lib/locale.functions'

export function useTranslation() {
  const { locale } = useRouteContext({ from: '__root__' })
  const t = translations[locale] as Translations

  const changeLocale = (newLocale: SupportedLocale) => {
    if (newLocale === locale) return
    setClientLocalePreference(newLocale)
    window.location.reload()
  }

  return {
    t,
    tWithParams: createNextTranslationFunction(t),
    locale,
    locales,
    defaultLocale: config.app.i18n.defaultLocale,
    changeLocale,
    isDefaultLocale: locale === config.app.i18n.defaultLocale,
  } as const
}
