import { createFileRoute } from '@tanstack/react-router'
import { seoHead } from '@/lib/seo'
import { useTranslation } from '@/hooks/use-translation'

export const Route = createFileRoute('/(root)/')({
  head: ({ match }) => seoHead(match.context.locale, (t) => t.home.metadata),
  component: HomePage,
})

function HomePage() {
  const { t, locale } = useTranslation()
  const year = new Date().getFullYear().toString()

  return (
    <div className="relative flex min-h-[calc(100svh-3.5rem)] flex-col overflow-hidden bg-background">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70 dark:opacity-35"
        style={{
          backgroundImage:
            'linear-gradient(to right, color-mix(in oklch, var(--border) 34%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklch, var(--border) 28%, transparent) 1px, transparent 1px)',
          backgroundSize: '4.5rem 4.5rem',
          maskImage: 'linear-gradient(to bottom, black, transparent 82%)',
        }}
      />

      <section
        data-testid="home-intro"
        className="relative mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 border-x border-border/60 lg:grid-cols-[minmax(0,1fr)_15rem]"
      >
        <div className="flex items-end px-6 pb-20 pt-24 sm:px-12 sm:pb-24 sm:pt-32 lg:px-16 lg:pb-28">
          <div className="max-w-3xl">
            <div className="mb-8 flex items-center gap-3 text-[0.68rem] font-medium uppercase tracking-[0.24em] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary" />
              {t.home.intro.eyebrow}
            </div>
            <h1 className="max-w-[13ch] text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-foreground sm:text-6xl lg:text-7xl">
              {t.home.intro.title}
            </h1>
            <p className="mt-8 max-w-xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              {t.home.intro.description}
            </p>
            <a
              href={`${import.meta.env.VITE_WEB_APP_ORIGIN || 'http://localhost:8001'}/${locale}/messages`}
              className="mt-9 inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5"
            >
              {t.home.intro.openChat}
            </a>
          </div>
        </div>

        <aside className="hidden border-l border-border/60 px-8 py-10 lg:flex lg:flex-col lg:justify-between">
          <span className="text-[0.65rem] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            {t.home.intro.index}
          </span>
          <div className="border-t border-border pt-5">
            <p className="text-xs leading-5 text-muted-foreground">
              {t.home.intro.status}
            </p>
          </div>
        </aside>
      </section>

      <footer
        data-testid="site-footer"
        className="relative border-t border-border/70 bg-background/80"
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>{t.home.footer.tagline}</span>
          <span>{t.home.footer.copyright.replace('{year}', year)}</span>
        </div>
      </footer>
    </div>
  )
}
