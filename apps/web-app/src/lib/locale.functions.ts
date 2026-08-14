import { match } from '@formatjs/intl-localematcher'
import Negotiator from 'negotiator'
import { createServerFn } from '@tanstack/react-start'
import { getCookie, getRequestHeader, setCookie } from '@tanstack/react-start/server'
import { config } from '@config'
import {
  defaultLocale,
  isValidLocale,
  locales,
  normalizeLocale,
  type SupportedLocale,
} from '@libs/i18n'

const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

function matchAcceptLanguage(header: string | undefined): SupportedLocale | null {
  if (!header) return null

  const requested = new Negotiator({
    headers: { 'accept-language': header },
  })
    .languages()
    .filter((locale) => locale !== '*')

  if (requested.length === 0) return null

  try {
    const matched = match(requested, [...locales], defaultLocale)
    return normalizeLocale(matched)
  } catch {
    return null
  }
}

export const getRequestLocale = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SupportedLocale> => {
    const cookieLocale = normalizeLocale(getCookie(config.app.i18n.cookieKey))
    if (cookieLocale) return cookieLocale

    if (config.app.i18n.autoDetect) {
      const detectedLocale = matchAcceptLanguage(getRequestHeader('accept-language'))
      if (detectedLocale) return detectedLocale
    }

    return defaultLocale
  },
)

export const setLocalePreference = createServerFn({ method: 'POST' })
  .inputValidator((locale: unknown): SupportedLocale => {
    if (typeof locale !== 'string' || !isValidLocale(locale)) {
      throw new Error('Unsupported locale')
    }
    return locale
  })
  .handler(async ({ data }) => {
    setCookie(config.app.i18n.cookieKey, data, {
      path: '/',
      maxAge: LOCALE_COOKIE_MAX_AGE,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
    return data
  })
