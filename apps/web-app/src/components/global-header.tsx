import { Link } from '@tanstack/react-router'
import { Check, Globe } from 'lucide-react'
import { config } from '@config'
import { type SupportedLocale, locales } from '@libs/i18n'
import { Button } from '@libs/react-shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@libs/react-shared/ui/dropdown-menu'
import { Logo } from '@libs/react-shared/ui/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { useTranslation } from '@/hooks/use-translation'

interface HeaderProps {
  className?: string
}

export default function Header({ className = '' }: HeaderProps) {
  const { t, locale: currentLocale, changeLocale } = useTranslation()

  const handleLanguageChange = (locale: SupportedLocale) => {
    void changeLocale(locale)
  }

  return (
    <header
      data-testid="site-header"
      className={`sticky top-0 z-40 w-full border-b border-border/70 bg-background/88 backdrop-blur-xl ${className}`}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link
          to="/"
          aria-label={config.app.name}
          className="rounded-md outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Logo size="sm" textClassName="font-semibold tracking-[-0.02em]" />
        </Link>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <div aria-hidden="true" className="mx-1 h-4 w-px bg-border" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 gap-2 px-2.5 text-muted-foreground hover:text-foreground"
                aria-label={t.header.language.switchLanguage}
              >
                <Globe className="size-4" />
                <span className="hidden text-xs font-medium sm:inline">
                  {currentLocale === 'en'
                    ? t.header.language.english
                    : t.header.language.chinese}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-36">
              {locales.map((locale) => (
                <DropdownMenuItem
                  key={locale}
                  onClick={() => handleLanguageChange(locale)}
                >
                  <span>
                    {locale === 'en'
                      ? t.header.language.english
                      : t.header.language.chinese}
                  </span>
                  {currentLocale === locale && <Check className="ml-auto size-4" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
