import { createFileRoute } from '@tanstack/react-router'
import { ShieldX } from 'lucide-react'
import { useTranslation } from '@/hooks/use-translation'

export const Route = createFileRoute('/forbidden')({ component: ForbiddenPage })

function ForbiddenPage() {
  const { t } = useTranslation()
  return (
    <main className="admin-gate">
      <div className="admin-gate-card" data-testid="admin-forbidden">
        <div className="admin-gate-icon admin-gate-icon-danger"><ShieldX /></div>
        <p className="admin-eyebrow">403</p>
        <h1>{t.adminApp.forbiddenTitle}</h1>
        <p>{t.adminApp.forbiddenDescription}</p>
      </div>
    </main>
  )
}
