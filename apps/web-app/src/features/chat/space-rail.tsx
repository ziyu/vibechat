'use client'

import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  CheckCheck,
  Check,
  Inbox,
  MoreHorizontal,
  Pin,
  PinOff,
  Plus,
  Search,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@vibechat/react-shared/ui/dropdown-menu'
import { filterRooms, formatRoomTime } from '@vibechat/product-core'
import { useTranslation } from '@/hooks/use-translation'
import { useChat } from './chat-store'
import { AvatarStack, EmptyState, SpaceGlyph } from './chat-primitives'
import { NewSpaceDialog } from './new-space-dialog'

export function SpaceRail({ activeSpaceId }: { activeSpaceId?: string }) {
  const { t, locale } = useTranslation()
  const {
    state,
    markRoomRead,
    toggleRoomMuted,
    toggleRoomPinned,
    acceptRoomInvite,
    rejectRoomInvite,
  } = useChat()
  const [query, setQuery] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const rooms = filterRooms(state, query, unreadOnly)

  return (
    <aside className="vc-space-rail" data-testid="space-list">
      <header className="vc-list-header">
        <div>
          <span className="vc-kicker">{t.chatApp.spaces.kicker}</span>
          <h1>{t.chatApp.spaces.title}</h1>
        </div>
        <button
          type="button"
          className="vc-icon-button vc-icon-button-accent"
          aria-label={t.chatApp.spaces.newSpace}
          title={t.chatApp.spaces.newSpace}
          onClick={() => setCreateOpen(true)}
          data-testid="new-space-button"
        >
          <Plus size={18} />
        </button>
      </header>

      <div className="vc-list-tools">
        <label className="vc-search-field">
          <Search size={15} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.chatApp.spaces.searchPlaceholder}
            data-testid="space-search"
          />
        </label>
        <button
          type="button"
          className="vc-filter-button"
          data-active={unreadOnly || undefined}
          aria-pressed={unreadOnly}
          onClick={() => setUnreadOnly((current) => !current)}
          data-testid="unread-filter"
        >
          <span>{t.chatApp.spaces.unread}</span>
          <i>{state.rooms.reduce((total, room) => total + room.unreadCount, 0)}</i>
        </button>
      </div>

      <div className="vc-room-list">
        {rooms.map((room) => {
          const members = room.memberIds
            .filter((id) => id !== state.currentUserId)
            .map((id) => state.people.find((person) => person.id === id))
            .filter((person): person is NonNullable<typeof person> => !!person)
          const space = state.spaces.find((candidate) => candidate.id === room.spaceId)!

          return (
            <article
              key={room.id}
              className="vc-room-row vc-space-row"
              data-active={room.id === activeSpaceId || undefined}
              data-unread={room.unreadCount > 0 || undefined}
              data-testid="space-row"
              data-membership={room.membership || 'join'}
            >
              <Link
                to="/spaces/$spaceId"
                params={{ spaceId: room.id }}
                onClick={() => markRoomRead(room.id)}
                className="vc-room-link"
              >
                <span className="vc-room-avatar-wrap vc-space-instance-mark">
                  <SpaceGlyph space={space} />
                  {room.unreadCount > 0 ? <i aria-hidden="true" /> : null}
                </span>
                <span className="vc-room-copy">
                  <span className="vc-room-title-line">
                    <strong>{room.name}</strong>
                    <time dateTime={room.updatedAt}>{formatRoomTime(room.updatedAt, locale)}</time>
                  </span>
                  <span className="vc-room-summary-line">
                    <small>
                      {room.membership === 'invite'
                        ? t.chatApp.contacts.spaceInvited
                        : room.lastMessage}
                    </small>
                    {room.muted ? <VolumeX size={12} aria-label={t.chatApp.spaces.muted} /> : null}
                    {room.unreadCount > 0 ? <i>{room.unreadCount}</i> : null}
                  </span>
                  <span className="vc-space-row-meta">
                    <AvatarStack people={members} />
                    <small>{space.name} · {room.memberIds.length}</small>
                  </span>
                </span>
              </Link>

              {room.membership === 'invite' ? (
                <span className="vc-invite-actions">
                  <button
                    type="button"
                    className="vc-icon-button vc-accept-button"
                    aria-label={t.chatApp.contacts.acceptSpaceInvite}
                    data-testid="accept-room-invite"
                    onClick={() => void acceptRoomInvite(room.id)}
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    className="vc-icon-button"
                    aria-label={t.chatApp.contacts.declineSpaceInvite}
                    onClick={() => void rejectRoomInvite(room.id)}
                  >
                    <X size={14} />
                  </button>
                </span>
              ) : null}

              {room.membership !== 'invite' ? <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="vc-room-more"
                    aria-label={t.chatApp.spaces.spaceActions}
                  >
                    <MoreHorizontal size={16} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="vc-menu-content">
                  <DropdownMenuItem onSelect={() => void toggleRoomPinned(room.id)}>
                    {room.pinned ? <PinOff /> : <Pin />}
                    {room.pinned ? t.chatApp.spaces.unpin : t.chatApp.spaces.pin}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void toggleRoomMuted(room.id)}>
                    {room.muted ? <Volume2 /> : <VolumeX />}
                    {room.muted ? t.chatApp.spaces.unmute : t.chatApp.spaces.mute}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => markRoomRead(room.id)}>
                    <CheckCheck />
                    {t.chatApp.spaces.markRead}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu> : null}
            </article>
          )
        })}

        {rooms.length === 0 ? (
          <EmptyState
            icon={<Inbox size={22} />}
            title={t.chatApp.spaces.noResults}
            description={t.chatApp.spaces.noResultsDescription}
          />
        ) : null}
      </div>

      <div className="vc-service-status">
        <span />
        <p>
          <strong>{t.chatApp.matrix.title}</strong>
          {t.chatApp.matrix.description}
        </p>
      </div>

      <NewSpaceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </aside>
  )
}
