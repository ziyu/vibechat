/// <reference types="vite/client" />
import { type ReactNode } from 'react'
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
  useRouterState,
} from '@tanstack/react-router'
import { config } from '@config'
import { locales } from '@libs/i18n'
import { ThemeProvider } from '@libs/react-shared/hooks/use-theme'
import { ThemeScript } from '@libs/react-shared/components/theme-script'
import { Toaster } from '@libs/react-shared/ui/sonner'
import '../styles.css'

export const Route = createRootRoute({
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
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function useHtmlLang(): string {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const segment = pathname.split('/')[1] ?? ''
  if ((locales as readonly string[]).includes(segment)) {
    return segment === 'zh-CN' ? 'zh-CN' : segment
  }
  return 'en'
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
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}
