import { createFileRoute, Outlet } from '@tanstack/react-router'
import { ProductShell } from '@/features/product/product-shell'
import { requireAuth } from '@/lib/auth-guard'
import '@/features/chat/chat.css'

export const Route = createFileRoute('/(product)')({
  beforeLoad: requireAuth,
  component: ProductLayout,
})

function ProductLayout() {
  return <ProductShell><Outlet /></ProductShell>
}
