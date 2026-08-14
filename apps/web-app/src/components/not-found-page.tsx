import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { config } from '@config'
import { Button } from '@libs/react-shared/ui/button'
import { Logo } from '@libs/react-shared/ui/logo'
import { useTranslation } from '@/hooks/use-translation'

export function NotFoundPage() {
  const { t } = useTranslation()
  const copy = t.common.pageNotFound

  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden bg-background px-6 py-16">
      <title>{copy.documentTitle}</title>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_oklab,var(--border)_35%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--border)_35%,transparent)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]"
      />

      <section className="relative w-full max-w-2xl text-center">
        <Link
          to="/"
          aria-label={config.app.name}
          className="mx-auto mb-12 inline-flex rounded-xl outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Logo size="md" />
        </Link>

        <p className="mb-5 text-xs font-semibold uppercase tracking-[0.28em] text-primary">
          {copy.eyebrow}
        </p>
        <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
          {copy.title}
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
          {copy.description}
        </p>

        <Button asChild size="lg" className="mt-10 rounded-xl px-6">
          <Link to="/">
            <ArrowLeft className="size-4" />
            {copy.backHome}
          </Link>
        </Button>
      </section>
    </main>
  )
}
