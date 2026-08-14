import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Logo } from '@vibechat/react-shared/ui/logo'
import { useTranslation } from '@/hooks/use-translation'

export function NotFoundPage() {
  const { t } = useTranslation()
  const copy = t.common.pageNotFound

  return (
    <main className="grid min-h-svh place-items-center bg-background px-6 py-16">
      <title>{copy.documentTitle}</title>
      <section className="w-full max-w-2xl text-center">
        <Link to="/admin" className="mb-12 inline-flex rounded-xl"><Logo size="md" /></Link>
        <p className="mb-5 text-xs font-semibold uppercase tracking-[0.28em] text-primary">{copy.eyebrow}</p>
        <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-6xl">{copy.title}</h1>
        <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">{copy.description}</p>
        <Link to="/admin" className="mt-10 inline-flex items-center gap-2 rounded-xl bg-foreground px-6 py-3 text-sm font-semibold text-background">
          <ArrowLeft className="size-4" />{copy.backHome}
        </Link>
      </section>
    </main>
  )
}
