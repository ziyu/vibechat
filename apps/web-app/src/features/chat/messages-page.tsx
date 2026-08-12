'use client'

import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowUpRight, MessageCircleMore, Plus, Sparkles, UsersRound } from 'lucide-react'
import { sortRooms } from '@vibechat/product-core'
import { useTranslation } from '@/hooks/use-translation'
import { useChat } from './chat-store'
import { ConversationRail } from './conversation-rail'
import { AvatarStack, PersonAvatar, SpaceGlyph } from './chat-primitives'
import { NewChatDialog } from './new-chat-dialog'

export function MessagesPage() {
  const { t, locale } = useTranslation()
  const { state } = useChat()
  const [createOpen, setCreateOpen] = useState(false)
  const rooms = sortRooms(state.rooms)
  const featuredSpace = state.spaces[0]
  const recentContacts = state.contactIds
    .slice(0, 4)
    .map((id) => state.people.find((person) => person.id === id))
    .filter((person): person is NonNullable<typeof person> => !!person)
  const unreadTotal = rooms.reduce((total, room) => total + room.unreadCount, 0)

  return (
    <div className="vc-messages-layout">
      <ConversationRail />

      <section className="vc-inbox-overview" data-testid="messages-overview">
        <header className="vc-overview-header">
          <span className="vc-live-indicator">
            <i /> {t.chatApp.messages.matrixSynced}
          </span>
          <div className="vc-overview-actions">
            <span>{t.chatApp.matrix.title}</span>
            <button
              type="button"
              className="vc-button vc-button-primary"
              onClick={() => setCreateOpen(true)}
            >
              <Plus size={16} />
              {t.chatApp.messages.newChat}
            </button>
          </div>
        </header>

        <div className="vc-overview-content">
          <section className="vc-welcome-block">
            <span className="vc-kicker">{t.chatApp.messages.today}</span>
            <h2>{t.chatApp.messages.welcomeBack}</h2>
            <p>
              {unreadTotal
                ? t.chatApp.messages.unreadSummary.replace('{count}', unreadTotal.toString())
                : t.chatApp.messages.caughtUp}
            </p>
          </section>

          <div className="vc-overview-grid">
            <section className="vc-featured-space-card">
              <div className="vc-featured-visual">
                <SpaceGlyph space={featuredSpace} />
                <span>{featuredSpace.icon}</span>
                <i />
              </div>
              <div className="vc-featured-copy">
                <span>
                  <Sparkles size={14} /> {t.chatApp.messages.featuredAtmosphere}
                </span>
                <h3>{featuredSpace.name}</h3>
                <p>{featuredSpace.summary}</p>
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="vc-text-link"
                >
                  {t.chatApp.messages.startWithSpace}
                  <ArrowUpRight size={15} />
                </button>
              </div>
            </section>

            <section className="vc-quick-contacts">
              <header>
                <span>
                  <UsersRound size={15} />
                  {t.chatApp.messages.recentPeople}
                </span>
                <Link to="/$lang/contacts" params={{ lang: locale }}>
                  {t.chatApp.common.viewAll}
                </Link>
              </header>
              <div>
                {recentContacts.map((person) => (
                  <button key={person.id} type="button" onClick={() => setCreateOpen(true)}>
                    <PersonAvatar person={person} size="lg" showPresence />
                    <strong>{person.displayName}</strong>
                    <small>{person.handle}</small>
                  </button>
                ))}
              </div>
            </section>
          </div>

          <section className="vc-recent-rooms">
            <header>
              <span className="vc-kicker">{t.chatApp.messages.recentActivity}</span>
              <h3>{t.chatApp.messages.pickUp}</h3>
            </header>
            <div>
              {rooms.slice(0, 3).map((room, index) => {
                const space = state.spaces.find((candidate) => candidate.id === room.spaceId)!
                const members = room.memberIds
                  .filter((id) => id !== state.currentUserId)
                  .map((id) => state.people.find((person) => person.id === id))
                  .filter((person): person is NonNullable<typeof person> => !!person)
                return (
                  <Link
                    key={room.id}
                    to="/$lang/rooms/$roomId"
                    params={{ lang: locale, roomId: room.id }}
                  >
                    <span className="vc-room-index">0{index + 1}</span>
                    <span className="vc-recent-room-copy">
                      <small>{space.name}</small>
                      <strong>{room.name}</strong>
                      <em>{room.lastMessage}</em>
                    </span>
                    <AvatarStack people={members} />
                    <MessageCircleMore size={17} />
                  </Link>
                )
              })}
            </div>
          </section>
        </div>
      </section>

      <NewChatDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialSpaceId={featuredSpace.id}
      />
    </div>
  )
}
