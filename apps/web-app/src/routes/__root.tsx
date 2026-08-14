/// <reference types="vite/client" />
import { useEffect, type ReactNode } from 'react'
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
  useLoaderData,
} from '@tanstack/react-router'
import { config } from '@config'
import { getPublicFeatureFlags } from '@/lib/feature-flags'
import { translations } from '@libs/i18n'
import { ThemeProvider } from '@libs/react-shared/hooks/use-theme'
import { ThemeScript } from '@libs/react-shared/components/theme-script'
import { SharedAppProvider } from '@libs/react-shared/providers/app-context'
import { Toaster } from '@libs/react-shared/ui/sonner'
import { getRequestLocale } from '@/lib/locale.functions'
import { NotFoundPage } from '@/components/not-found-page'
import '../styles.css'

export const Route = createRootRoute({
  beforeLoad: async () => ({ locale: await getRequestLocale() }),
  loader: () => getPublicFeatureFlags(),
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: config.app.name },
    ],
    links: [
      { rel: 'icon', href: '/favicon.ico' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      { rel: 'manifest', href: '/site.webmanifest' },
    ],
  }),
  notFoundComponent: NotFoundPage,
  component: RootComponent,
})

export function useAffiliateEnabled() {
  return useLoaderData({
    from: '__root__',
    select: (data) => data.affiliateEnabled,
  })
}

function useReferralCapture() {
  useEffect(() => {
    const url = new URL(window.location.href)
    const ref = url.searchParams.get('ref')
    if (!ref) return
    const referralCookieName = config.affiliate.cookie.name
    const existing = document.cookie.split(';').some(c => c.trim().startsWith(`${referralCookieName}=`))
    if (!existing) {
      const expires = new Date(
        Date.now() + config.affiliate.cookie.expiryDays * 24 * 60 * 60 * 1000,
      ).toUTCString()
      document.cookie = `${referralCookieName}=${encodeURIComponent(ref)}; path=/; expires=${expires}; samesite=lax`
    }
    url.searchParams.delete('ref')
    window.history.replaceState({}, '', url.pathname + url.search + url.hash)
  }, [])
}

function RootComponent() {
  useReferralCapture()
  const { locale } = Route.useRouteContext()
  const t = translations[locale]
  return (
    <SharedAppProvider value={{ t, locale }}>
      <RootDocument locale={locale}>
        <Outlet />
      </RootDocument>
    </SharedAppProvider>
  )
}

function RootDocument({
  children,
  locale,
}: Readonly<{ children: ReactNode; locale: string }>) {
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <HeadContent />
        <ThemeScript />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}
