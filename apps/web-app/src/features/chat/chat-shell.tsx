'use client'

import { Link, useRouterState } from '@tanstack/react-router'
import { Compass, ContactRound, MessageCircleMore, UserRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from '@/hooks/use-translation'
import { useChatDemo } from './chat-store'
import { PersonAvatar } from './chat-primitives'

interface NavItem {
  id: 'messages' | 'contacts' | 'discover' | 'me'
  to: '/$lang/messages' | '/$lang/contacts' | '/$lang/discover' | '/$lang/me'
  icon: LucideIcon
  label: string
}

export function ChatShell({ children }: { children: React.ReactNode }) {
  const { t, locale } = useTranslation()
  const { state, ready, mode, syncState } = useChatDemo()
  const pathname = useRouterState({ select: (routerState) => routerState.location.pathname })
  const currentUser = state.people.find((person) => person.id === state.currentUserId)!
  const inRoom = pathname.includes('/rooms/')

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
      data-mode={mode}
      data-sync-state={syncState}
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
          <PersonAvatar person={currentUser} size="sm" showPresence />
        </Link>
      </aside>

      <main className="vc-workspace">{children}</main>

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
