import { createFileRoute, Outlet } from '@tanstack/react-router'
import Header from '@/components/site-header'

export const Route = createFileRoute('/(root)')({
  component: RootLayout,
})

function RootLayout() {
  return (
    <>
      <Header />
      <main>
        <Outlet />
      </main>
    </>
  )
}
