import { createFileRoute, Outlet } from '@tanstack/react-router'
import { SidebarProvider, SidebarTrigger } from '@vibechat/react-shared/ui/sidebar'
import { AppSidebar } from '@/components/admin/app-sidebar'
import { requireAdmin } from '@/lib/auth-guard'
import { useTranslation } from '@/hooks/use-translation'

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    await requireAdmin()
  },
  component: AdminLayout,
})

function AdminLayout() {
  const { t } = useTranslation()
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="admin-main flex-grow" data-testid="admin-shell">
        <header className="admin-topbar">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="admin-sidebar-trigger" />
            <div>
              <p className="admin-eyebrow">{t.adminApp.environment}</p>
              <p className="text-sm font-medium">{t.adminApp.workspace}</p>
            </div>
          </div>
          <span className="admin-status"><i /> {t.adminApp.environment}</span>
        </header>
        <div className="admin-content"><Outlet /></div>
      </main>
    </SidebarProvider>
  )
}
