/// <reference types="vite/client" />
import { type ReactNode } from 'react'
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  useRouterState,
} from '@tanstack/react-router'
import { config } from '@config'
import { locales } from '@libs/i18n'
import { ThemeProvider } from '@libs/react-shared/hooks/use-theme'
import { ThemeScript } from '@libs/react-shared/components/theme-script'
import '../styles.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: config.app.name },
    ],
    links: [
      { rel: 'icon', href: '/logo.svg', type: 'image/svg+xml' },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function useHtmlLang() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const segment = pathname.split('/')[1] ?? ''
  return (locales as readonly string[]).includes(segment) ? segment : 'en'
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  const lang = useHtmlLang()
  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        <HeadContent />
        <ThemeScript />
      </head>
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}
