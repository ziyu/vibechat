import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/(root)')({
  component: RootLayout,
})

function RootLayout() {
  return <Outlet />
}
