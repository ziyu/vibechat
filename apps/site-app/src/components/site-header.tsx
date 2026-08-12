import { Link, useLocation } from '@tanstack/react-router'
import { Globe2 } from 'lucide-react'
import { config } from '@config'
import type { SupportedLocale } from '@libs/i18n'
import { Logo } from '@libs/react-shared/ui/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { useTranslation } from '@/hooks/use-translation'

export default function SiteHeader() {
  const location = useLocation()
  const { t, locale } = useTranslation()
  const targetLocale: SupportedLocale = locale === 'en' ? 'zh-CN' : 'en'
  const pathWithoutLocale = location.pathname.replace(`/${locale}`, '') || '/'
  const webOrigin = import.meta.env.VITE_WEB_APP_ORIGIN || 'http://localhost:8001'

  const persistLocale = () => {
    document.cookie = `${config.app.i18n.cookieKey}=${targetLocale}; path=/; max-age=31536000`
  }

  return (
    <header
      data-testid="site-header"
      className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/88 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link
          to="/$lang"
          params={{ lang: locale }}
          aria-label={config.app.name}
          className="rounded-md outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Logo size="sm" textClassName="font-semibold tracking-[-0.02em]" />
        </Link>

        <div className="flex items-center gap-1.5">
          <Link
            to="/$lang/blog"
            params={{ lang: locale }}
            search={{ page: 1 }}
            className="hidden rounded-full px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
          >
            {t.header.navigation.blog}
          </Link>
          <a
            href={`${webOrigin}/${locale}/messages`}
            className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-transform hover:-translate-y-0.5"
          >
            {t.home.intro.openChat}
          </a>
          <ThemeToggle />
          <a
            href={`/${targetLocale}${pathWithoutLocale}`}
            onClick={persistLocale}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t.header.language.switchLanguage}
          >
            <Globe2 className="size-4" />
            <span>{targetLocale === 'en' ? 'EN' : '中文'}</span>
          </a>
        </div>
      </div>
    </header>
  )
}
