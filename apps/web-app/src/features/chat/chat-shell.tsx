'use client'

import { Link, useRouterState } from '@tanstack/react-router'
import { Compass, ContactRound, MessageCircleMore, UserRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from '@/hooks/use-translation'
import { useTheme } from '@libs/react-shared/hooks/use-theme'
import { useEffect } from 'react'
import { useChat } from './chat-store'
import { PersonAvatar } from './chat-primitives'
import { authClientReact } from '@vibechat/auth-client'
import { browserProductPlatform } from '@/lib/product-platform'

interface NavItem {
  id: 'messages' | 'contacts' | 'discover' | 'me'
  to: '/$lang/messages' | '/$lang/contacts' | '/$lang/discover' | '/$lang/me'
  icon: LucideIcon
  label: string
}

export function ChatShell({ children }: { children: React.ReactNode }) {
  const { t, locale } = useTranslation()
  const { setTheme } = useTheme()
  const {
    state,
    ready,
    connectionState,
    productPreferences,
    retryConnection,
    clearLocalChatData,
  } = useChat()
  const pathname = useRouterState({ select: (routerState) => routerState.location.pathname })
  const currentUser = state.people.find((person) => person.id === state.currentUserId)
  const inRoom = pathname.includes('/rooms/')

  const leaveProduct = async () => {
    await clearLocalChatData().catch(() => undefined)
    await authClientReact.signOut().catch(() => undefined)
    browserProductPlatform.navigation.openSignIn(locale)
  }

  useEffect(() => {
    if (!ready) return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const applyPreference = () => setTheme(
      productPreferences.theme === 'system'
        ? media.matches ? 'dark' : 'light'
        : productPreferences.theme,
    )
    applyPreference()
    if (productPreferences.theme === 'system') media.addEventListener('change', applyPreference)
    return () => media.removeEventListener('change', applyPreference)
  }, [productPreferences.theme, ready, setTheme])

  const items: NavItem[] = [
    {
      id: 'messages',
      to: '/$lang/messages',
      icon: MessageCircleMore,
      label: t.chatApp.nav.messages,
    },
    {
      id: 'contacts',
      to: '/$lang/contacts',
      icon: ContactRound,
      label: t.chatApp.nav.contacts,
    },
    {
      id: 'discover',
      to: '/$lang/discover',
      icon: Compass,
      label: t.chatApp.nav.discover,
    },
    {
      id: 'me',
      to: '/$lang/me',
      icon: UserRound,
      label: t.chatApp.nav.me,
    },
  ]

  const isActive = (item: NavItem) => {
    const section = pathname.split('/')[2]
    if (item.id === 'messages') return section === 'messages' || section === 'rooms'
    return section === item.id
  }

  return (
    <div
      className="vc-app"
      data-room-open={inRoom || undefined}
      data-ready={ready ? 'true' : 'false'}
      data-mode="matrix"
      data-sync-state={connectionState}
      data-testid="chat-app-shell"
    >
      <aside className="vc-primary-rail" data-testid="chat-primary-nav">
        <Link
          to="/$lang/messages"
          params={{ lang: locale }}
          className="vc-brand-mark"
          aria-label={t.common.siteName}
        >
          <span>V</span>
        </Link>

        <nav aria-label={t.chatApp.nav.primaryLabel}>
          {items.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.id}
                to={item.to}
                params={{ lang: locale }}
                className="vc-primary-link"
                data-active={isActive(item) || undefined}
              >
                <Icon size={20} strokeWidth={1.8} />
                <span>{item.label}</span>
                {item.id === 'messages' && state.rooms.some((room) => room.unreadCount > 0) ? (
                  <i aria-hidden="true" />
                ) : null}
              </Link>
            )
          })}
        </nav>

        <Link
          to="/$lang/me"
          params={{ lang: locale }}
          className="vc-rail-profile"
          aria-label={t.chatApp.me.profile}
        >
          {currentUser ? <PersonAvatar person={currentUser} size="sm" showPresence /> : <span>V</span>}
        </Link>
      </aside>

      <main className="vc-workspace">
        {!ready ? (
          <section className="vc-service-state" data-testid="chat-service-state">
            <span>V</span>
            <h1>{connectionState === 'CONNECTING'
              ? t.chatApp.service.connecting
              : connectionState === 'UNAVAILABLE'
                ? t.chatApp.service.unavailable
                : t.chatApp.service.failed}</h1>
            <p>{connectionState === 'CONNECTING'
              ? t.chatApp.service.connectingDescription
              : connectionState === 'UNAVAILABLE'
                ? t.chatApp.service.unavailableDescription
                : t.chatApp.service.failedDescription}</p>
            {connectionState !== 'CONNECTING' ? (
              <div className="vc-service-actions">
                <button type="button" className="vc-button vc-button-primary" onClick={retryConnection}>
                  {t.actions.tryAgain}
                </button>
                <button type="button" className="vc-button" onClick={() => void leaveProduct()}>
                  {t.chatApp.me.signOut}
                </button>
              </div>
            ) : null}
          </section>
        ) : children}
      </main>

      <nav className="vc-mobile-nav" aria-label={t.chatApp.nav.primaryLabel}>
        {items.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.id}
              to={item.to}
              params={{ lang: locale }}
              className="vc-mobile-link"
              data-active={isActive(item) || undefined}
            >
              <Icon size={21} strokeWidth={1.8} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
