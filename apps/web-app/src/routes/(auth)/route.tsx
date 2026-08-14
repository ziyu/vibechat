import { createFileRoute, Outlet } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'
import { Logo } from '@vibechat/react-shared/ui/logo'
import { redirectIfAuthenticated } from '@/lib/auth-guard'

export const Route = createFileRoute('/(auth)')({
  beforeLoad: async () => {
    await redirectIfAuthenticated()
  },
  component: AuthLayout,
})

function AuthLayout() {
  return (
    <main className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link to="/" className="self-center">
          <Logo size="md" />
        </Link>
        <Outlet />
      </div>
    </main>
  )
}
