import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { ArrowUpRight, LockKeyhole } from 'lucide-react'
import { Button } from '@vibechat/react-shared/ui/button'
import { useTranslation } from '@/hooks/use-translation'

export const Route = createFileRoute('/$lang/signin')({ component: AdminSignIn })

function AdminSignIn() {
  const { t, locale } = useTranslation()
  const webOrigin = (import.meta.env.VITE_WEB_APP_ORIGIN || 'http://localhost:8001').replace(/\/$/, '')
  const adminOrigin = (import.meta.env.VITE_ADMIN_APP_ORIGIN || 'http://localhost:8005').replace(/\/$/, '')
  const returnTo = `${adminOrigin}/${locale}/admin`
  const destination = `${webOrigin}/${locale}/signin?returnTo=${encodeURIComponent(returnTo)}`

  useEffect(() => {
    const timer = window.setTimeout(() => window.location.replace(destination), 250)
    return () => window.clearTimeout(timer)
  }, [destination])

  return (
    <main className="admin-gate">
      <div className="admin-gate-card">
        <div className="admin-gate-icon"><LockKeyhole /></div>
        <p className="admin-eyebrow">{t.adminApp.secureWorkspace}</p>
        <h1>{t.adminApp.signInTitle}</h1>
        <p>{t.adminApp.signInDescription}</p>
        <Button asChild className="mt-6">
          <a href={destination}>{t.adminApp.openSignIn}<ArrowUpRight /></a>
        </Button>
      </div>
    </main>
  )
}
