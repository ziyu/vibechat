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
} from '@libs/react-shared/ui/dropdown-menu'
import { filterRooms, formatRoomTime } from '@libs/chat'
import { useTranslation } from '@/hooks/use-translation'
import { useChatDemo } from './chat-store'
import { AvatarStack, EmptyState, PersonAvatar, SpaceGlyph } from './chat-primitives'
import { NewChatDialog } from './new-chat-dialog'

export function ConversationRail({ activeRoomId }: { activeRoomId?: string }) {
  const { t, locale } = useTranslation()
  const {
    state,
    mode,
    markRoomRead,
    toggleRoomMuted,
    toggleRoomPinned,
    acceptRoomInvite,
    rejectRoomInvite,
  } = useChatDemo()
  const [query, setQuery] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const rooms = filterRooms(state, query, unreadOnly)

  return (
    <aside className="vc-conversation-rail" data-testid="conversation-list">
      <header className="vc-list-header">
        <div>
          <span className="vc-kicker">{t.chatApp.messages.kicker}</span>
          <h1>{t.chatApp.messages.title}</h1>
        </div>
        <button
          type="button"
          className="vc-icon-button vc-icon-button-accent"
          aria-label={t.chatApp.messages.newChat}
          title={t.chatApp.messages.newChat}
          onClick={() => setCreateOpen(true)}
          data-testid="new-chat-button"
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
            placeholder={t.chatApp.messages.searchPlaceholder}
            data-testid="conversation-search"
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
          <span>{t.chatApp.messages.unread}</span>
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
              className="vc-room-row"
              data-active={room.id === activeRoomId || undefined}
              data-unread={room.unreadCount > 0 || undefined}
              data-testid="conversation-row"
              data-membership={room.membership || 'join'}
            >
              <Link
                to="/$lang/rooms/$roomId"
                params={{ lang: locale, roomId: room.id }}
                onClick={() => markRoomRead(room.id)}
                className="vc-room-link"
              >
                <span className="vc-room-avatar-wrap">
                  {members.length === 1 ? (
                    <PersonAvatar person={members[0]} size="lg" showPresence />
                  ) : (
                    <AvatarStack people={members} />
                  )}
                  <SpaceGlyph space={space} className="vc-room-space-badge" />
                </span>
                <span className="vc-room-copy">
                  <span className="vc-room-title-line">
                    <strong>{room.name}</strong>
                    <time dateTime={room.updatedAt}>{formatRoomTime(room.updatedAt, locale)}</time>
                  </span>
                  <span className="vc-room-summary-line">
                    <small>
                      {room.membership === 'invite'
                        ? t.chatApp.contacts.invited
                        : room.lastMessage}
                    </small>
                    {room.muted ? <VolumeX size={12} aria-label={t.chatApp.messages.muted} /> : null}
                    {room.unreadCount > 0 ? <i>{room.unreadCount}</i> : null}
                  </span>
                </span>
              </Link>

              {room.membership === 'invite' ? (
                <span className="vc-invite-actions">
                  <button
                    type="button"
                    className="vc-icon-button vc-accept-button"
                    aria-label={t.chatApp.contacts.acceptInvite}
                    data-testid="accept-room-invite"
                    onClick={() => void acceptRoomInvite(room.id)}
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    className="vc-icon-button"
                    aria-label={t.chatApp.contacts.declineInvite}
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
                    aria-label={t.chatApp.messages.roomActions}
                  >
                    <MoreHorizontal size={16} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="vc-menu-content">
                  <DropdownMenuItem onSelect={() => toggleRoomPinned(room.id)}>
                    {room.pinned ? <PinOff /> : <Pin />}
                    {room.pinned ? t.chatApp.messages.unpin : t.chatApp.messages.pin}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => toggleRoomMuted(room.id)}>
                    {room.muted ? <Volume2 /> : <VolumeX />}
                    {room.muted ? t.chatApp.messages.unmute : t.chatApp.messages.mute}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => markRoomRead(room.id)}>
                    <CheckCheck />
                    {t.chatApp.messages.markRead}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu> : null}
            </article>
          )
        })}

        {rooms.length === 0 ? (
          <EmptyState
            icon={<Inbox size={22} />}
            title={t.chatApp.messages.noResults}
            description={t.chatApp.messages.noResultsDescription}
          />
        ) : null}
      </div>

      <div className="vc-demo-status">
        <span />
        <p>
          <strong>{mode === 'matrix' ? t.chatApp.matrix.title : t.chatApp.demo.title}</strong>
          {mode === 'matrix' ? t.chatApp.matrix.description : t.chatApp.demo.description}
        </p>
      </div>

      <NewChatDialog open={createOpen} onOpenChange={setCreateOpen} />
    </aside>
  )
}
