import { createServerFn } from '@tanstack/react-start'
import { getCookie, getRequestHeader, setCookie } from '@tanstack/react-start/server'
import { config } from '@config'
import { normalizeLocale, type SupportedLocale } from '@vibechat/i18n'

const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export function setClientLocalePreference(locale: SupportedLocale) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${config.app.i18n.cookieKey}=${encodeURIComponent(locale)}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax${secure}`
}

function detectRequestLocale(): SupportedLocale | null {
  if (!config.app.i18n.autoDetect) return null
  const header = getRequestHeader('accept-language')
  if (!header) return null

  for (const entry of header.split(',')) {
    const matched = normalizeLocale(entry.split(';', 1)[0])
    if (matched) return matched
  }
  return null
}

export const getRequestLocale = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SupportedLocale> =>
    normalizeLocale(getCookie(config.app.i18n.cookieKey))
    ?? detectRequestLocale()
    ?? config.app.i18n.defaultLocale,
)

export const setLocalePreference = createServerFn({ method: 'POST' })
  .inputValidator((locale: unknown): SupportedLocale => {
    const normalized = typeof locale === 'string' ? normalizeLocale(locale) : null
    if (!normalized) throw new Error('Unsupported locale')
    return normalized
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
