'use client'

import { useNavigate, useParams, useRouterState } from '@tanstack/react-router'
import {
  locales,
  translations,
  type SupportedLocale,
  type Translations,
} from '@libs/i18n'
import { createNextTranslationFunction } from '@libs/validators'
import { config } from '@config'

export function useTranslation() {
  const params = useParams({ strict: false }) as { lang?: string }
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const locale = (params.lang as SupportedLocale) || config.app.i18n.defaultLocale
  const t = translations[locale] as Translations

  const changeLocale = (newLocale: SupportedLocale) => {
    const pathWithoutLocale = pathname.replace(`/${locale}`, '') || '/'
    void navigate({ to: `/${newLocale}${pathWithoutLocale}` })
    document.cookie = `${config.app.i18n.cookieKey}=${newLocale}; path=/; max-age=31536000`
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
