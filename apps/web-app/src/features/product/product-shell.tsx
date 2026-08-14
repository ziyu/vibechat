'use client'

import { Link, useRouterState } from '@tanstack/react-router'
import { Compass, ContactRound, MessageCircleMore, Shapes, UserRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { authClientReact } from '@vibechat/auth-client'
import { useTranslation } from '@/hooks/use-translation'

interface NavItem {
  id: 'messages' | 'contacts' | 'discover' | 'services' | 'me'
  to: '/$lang/messages' | '/$lang/contacts' | '/$lang/discover' | '/$lang/services' | '/$lang/me'
  icon: LucideIcon
  label: string
}

export function ProductShell({ children }: { children: React.ReactNode }) {
  const { t, locale } = useTranslation()
  const { data: session } = authClientReact.useSession()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const section = pathname.split('/')[2]
  const initials = session?.user?.name?.trim().slice(0, 1).toUpperCase()
    || session?.user?.email?.slice(0, 1).toUpperCase()
    || 'V'
  const items: NavItem[] = [
    { id: 'messages', to: '/$lang/messages', icon: MessageCircleMore, label: t.chatApp.nav.messages },
    { id: 'contacts', to: '/$lang/contacts', icon: ContactRound, label: t.chatApp.nav.contacts },
    { id: 'discover', to: '/$lang/discover', icon: Compass, label: t.chatApp.nav.discover },
    { id: 'services', to: '/$lang/services', icon: Shapes, label: t.chatApp.nav.services },
    { id: 'me', to: '/$lang/me', icon: UserRound, label: t.chatApp.nav.me },
  ]
  const isActive = (item: NavItem) => item.id === 'services'
    ? ['services', 'pricing', 'upload', 'ai', 'image-generate', 'video-generate', 'premium-features', 'payment-success', 'payment-cancel'].includes(section || '')
    : item.id === 'me'
      ? ['me', 'account', 'dashboard'].includes(section || '')
      : item.id === section

  return (
    <div className="vc-app" data-mode="product" data-testid="product-app-shell">
      <aside className="vc-primary-rail" data-testid="product-primary-nav">
        <Link to="/$lang/messages" params={{ lang: locale }} className="vc-brand-mark" aria-label={t.common.siteName}>
          <span>V</span>
        </Link>
        <nav aria-label={t.chatApp.nav.primaryLabel}>
          {items.map((item) => {
            const Icon = item.icon
            return (
              <Link key={item.id} to={item.to} params={{ lang: locale }} className="vc-primary-link" data-active={isActive(item) || undefined}>
                <Icon size={20} strokeWidth={1.8} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
        <Link to="/$lang/account" params={{ lang: locale }} className="vc-product-avatar" aria-label={t.chatApp.account.title}>
          {initials}
        </Link>
      </aside>
      <main className="vc-workspace">{children}</main>
      <nav className="vc-mobile-nav" aria-label={t.chatApp.nav.primaryLabel}>
        {items.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.id} to={item.to} params={{ lang: locale }} className="vc-mobile-link" data-active={isActive(item) || undefined}>
              <Icon size={21} strokeWidth={1.8} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
