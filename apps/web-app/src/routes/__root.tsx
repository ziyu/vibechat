/// <reference types="vite/client" />
import { type ReactNode } from 'react'
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from '@tanstack/react-router'
import { config } from '@config'
import { translations } from '@vibechat/i18n'
import { ThemeProvider } from '@vibechat/react-shared/hooks/use-theme'
import { ThemeScript } from '@vibechat/react-shared/components/theme-script'
import { SharedAppProvider } from '@vibechat/react-shared/providers/app-context'
import { Toaster } from '@vibechat/react-shared/ui/sonner'
import { ReferralClaim } from '@/features/account/referral-claim'
import { NotFoundPage } from '@/components/not-found-page'
import { getRequestLocale } from '@/lib/locale.functions'
import '../styles.css'

export const Route = createRootRoute({
  beforeLoad: async () => ({ locale: await getRequestLocale() }),
  notFoundComponent: NotFoundPage,
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
  component: RootComponent,
})

function RootComponent() {
  const { locale } = Route.useRouteContext()
  const t = translations[locale]
  return (
    <SharedAppProvider value={{ t, locale }}>
      <ReferralClaim />
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
        <ThemeScript
          storageKey={config.app.theme.storageKey}
          defaultTheme={config.app.theme.defaultTheme}
          defaultColorScheme={config.app.theme.defaultColorScheme}
        />
      </head>
      <body className="antialiased">
        <ThemeProvider
          storageKey={config.app.theme.storageKey}
          defaultTheme={config.app.theme.defaultTheme}
          defaultColorScheme={config.app.theme.defaultColorScheme}
        >
          {children}
          <Toaster />
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}
