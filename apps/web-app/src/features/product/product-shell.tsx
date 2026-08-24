'use client'

import { Link, useRouterState } from '@tanstack/react-router'
import { Compass, ContactRound, Orbit, Shapes, UserRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { authClientReact } from '@vibechat/auth-client'
import { useTranslation } from '@/hooks/use-translation'

interface NavItem {
  id: 'spaces' | 'contacts' | 'discover' | 'services' | 'me'
  to: '/spaces' | '/contacts' | '/discover' | '/services' | '/me'
  icon: LucideIcon
  label: string
}

export function ProductShell({ children }: { children: React.ReactNode }) {
  const { t, locale } = useTranslation()
  const { data: session } = authClientReact.useSession()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const section = pathname.split('/').filter(Boolean)[0]
  const initials = session?.user?.name?.trim().slice(0, 1).toUpperCase()
    || session?.user?.email?.slice(0, 1).toUpperCase()
    || 'V'
  const items: NavItem[] = [
    { id: 'spaces', to: '/spaces', icon: Orbit, label: t.chatApp.nav.spaces },
    { id: 'contacts', to: '/contacts', icon: ContactRound, label: t.chatApp.nav.contacts },
    { id: 'discover', to: '/discover', icon: Compass, label: t.chatApp.nav.discover },
    { id: 'services', to: '/services', icon: Shapes, label: t.chatApp.nav.services },
    { id: 'me', to: '/me', icon: UserRound, label: t.chatApp.nav.me },
  ]
  const isActive = (item: NavItem) => item.id === 'services'
    ? ['services', 'pricing', 'upload', 'ai', 'image-generate', 'video-generate', 'premium-features', 'payment-success', 'payment-cancel'].includes(section || '')
    : item.id === 'me'
      ? ['me', 'account', 'dashboard'].includes(section || '')
      : item.id === section

  return (
    <div className="vc-app" data-mode="product" data-testid="product-app-shell">
      <aside className="vc-primary-rail" data-testid="product-primary-nav">
        <Link to="/spaces" className="vc-brand-mark" aria-label={t.common.siteName}>
          <span>V</span>
        </Link>
        <nav aria-label={t.chatApp.nav.primaryLabel}>
          {items.map((item) => {
            const Icon = item.icon
            return (
              <Link key={item.id} to={item.to} className="vc-primary-link" data-active={isActive(item) || undefined}>
                <Icon size={20} strokeWidth={1.8} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
        <Link to="/account" className="vc-product-avatar" aria-label={t.chatApp.account.title}>
          {initials}
        </Link>
      </aside>
      <main className="vc-workspace">{children}</main>
      <nav className="vc-mobile-nav" aria-label={t.chatApp.nav.primaryLabel}>
        {items.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.id} to={item.to} className="vc-mobile-link" data-active={isActive(item) || undefined}>
              <Icon size={21} strokeWidth={1.8} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
