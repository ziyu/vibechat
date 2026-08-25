'use client'

import { useState, type CSSProperties } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowUpRight, Layers3, MessageCircleMore, Plus, Sparkles, UsersRound } from 'lucide-react'
import { formatRoomTime, sortRooms } from '@vibechat/product-core'
import { useTranslation } from '@/hooks/use-translation'
import { useChat } from './chat-store'
import { AvatarStack, EmptyState, SpaceGlyph } from './chat-primitives'
import { NewSpaceDialog } from './new-space-dialog'
import { SpaceRail } from './space-rail'

export function SpacesPage() {
  const { t, locale } = useTranslation()
  const { state, markRoomRead } = useChat()
  const [createOpen, setCreateOpen] = useState(false)
  const rooms = sortRooms(state.rooms)
  const unreadTotal = rooms.reduce((total, room) => total + room.unreadCount, 0)
  const memberTotal = new Set(rooms.flatMap((room) => room.memberIds)).size

  return (
    <div className="vc-spaces-layout">
      <SpaceRail />

      <section className="vc-inbox-overview vc-spaces-overview" data-testid="spaces-overview">
        <header className="vc-overview-header">
          <span className="vc-live-indicator">
            <i /> {t.chatApp.spaces.matrixSynced}
          </span>
          <div className="vc-overview-actions">
            <span>{t.chatApp.spaces.kernelReady}</span>
            <button
              type="button"
              className="vc-button vc-button-primary"
              onClick={() => setCreateOpen(true)}
              data-testid="create-space-hero"
            >
              <Plus size={16} />
              {t.chatApp.spaces.newSpace}
            </button>
          </div>
        </header>

        <div className="vc-overview-content vc-spaces-content">
          <section className="vc-spaces-hero">
            <div className="vc-spaces-hero-copy">
              <span className="vc-kicker">{t.chatApp.spaces.heroKicker}</span>
              <h2>{t.chatApp.spaces.heroTitle}</h2>
              <p>{t.chatApp.spaces.heroDescription}</p>
            </div>
            <dl className="vc-spaces-stats" aria-label={t.chatApp.spaces.statsLabel}>
              <div>
                <dt>{t.chatApp.spaces.spaceCount}</dt>
                <dd>{rooms.length.toString().padStart(2, '0')}</dd>
              </div>
              <div>
                <dt>{t.chatApp.spaces.memberCount}</dt>
                <dd>{memberTotal.toString().padStart(2, '0')}</dd>
              </div>
              <div>
                <dt>{t.chatApp.spaces.unreadCount}</dt>
                <dd>{unreadTotal.toString().padStart(2, '0')}</dd>
              </div>
            </dl>
          </section>

          {rooms.length > 0 ? (
            <section className="vc-space-instance-section" aria-labelledby="space-instance-heading">
              <header>
                <div>
                  <span className="vc-kicker">{t.chatApp.spaces.collectionKicker}</span>
                  <h3 id="space-instance-heading">{t.chatApp.spaces.collectionTitle}</h3>
                </div>
                <Link to="/discover">
                  <Sparkles size={14} />
                  {t.chatApp.spaces.browseTemplates}
                </Link>
              </header>

              <div className="vc-space-instance-grid">
                {rooms.map((room, index) => {
                  const template = state.spaces.find((candidate) => candidate.id === room.spaceId)
                  if (!template) return null
                  const members = room.memberIds
                    .map((id) => state.people.find((person) => person.id === id))
                    .filter((person): person is NonNullable<typeof person> => !!person)

                  return (
                    <Link
                      key={room.id}
                      to="/spaces/$spaceId"
                      params={{ spaceId: room.id }}
                      className="vc-space-instance-card"
                      data-unread={room.unreadCount > 0 || undefined}
                      data-testid="space-card"
                      onClick={() => markRoomRead(room.id)}
                      style={{
                        '--instance-accent': template.accent,
                        '--instance-canvas': template.canvas,
                        '--instance-order': index,
                      } as CSSProperties}
                    >
                      <span className="vc-space-instance-visual">
                        <SpaceGlyph space={template} />
                        <i aria-hidden="true" />
                        <span>
                          <Layers3 size={13} />
                          {template.name}
                        </span>
                      </span>
                      <span className="vc-space-instance-copy">
                        <span className="vc-space-instance-heading">
                          <strong>{room.name}</strong>
                          {room.unreadCount > 0 ? (
                            <i>{t.chatApp.spaces.unreadBadge.replace('{count}', room.unreadCount.toString())}</i>
                          ) : null}
                        </span>
                        <small>{template.summary}</small>
                        <em>{room.lastMessage || t.chatApp.spaces.emptyChat}</em>
                      </span>
                      <span className="vc-space-instance-footer">
                        <span>
                          <AvatarStack people={members} limit={4} />
                          <small><UsersRound size={12} /> {members.length}</small>
                        </span>
                        <time dateTime={room.updatedAt}>{formatRoomTime(room.updatedAt, locale)}</time>
                        <ArrowUpRight size={17} />
                      </span>
                    </Link>
                  )
                })}

                <button
                  type="button"
                  className="vc-space-instance-card vc-space-create-card"
                  onClick={() => setCreateOpen(true)}
                >
                  <span><Plus size={22} /></span>
                  <strong>{t.chatApp.spaces.createCardTitle}</strong>
                  <small>{t.chatApp.spaces.createCardDescription}</small>
                </button>
              </div>
            </section>
          ) : (
            <EmptyState
              icon={<MessageCircleMore size={22} />}
              title={t.chatApp.spaces.emptyTitle}
              description={t.chatApp.spaces.emptyDescription}
              action={(
                <button type="button" className="vc-button vc-button-primary" onClick={() => setCreateOpen(true)}>
                  <Plus size={15} /> {t.chatApp.spaces.newSpace}
                </button>
              )}
            />
          )}
        </div>
      </section>

      <NewSpaceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
