'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  CheckCheck,
  MoreHorizontal,
  Pin,
  PinOff,
  Volume2,
  VolumeX,
  UsersRound,
} from 'lucide-react'
import type { SpaceAppBridgeRequest } from '@vibechat/space-app-contracts'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@vibechat/react-shared/ui/dropdown-menu'
import { getRoomMessages } from '@vibechat/product-core'
import { useTranslation } from '@/hooks/use-translation'
import { useChat } from './chat-store'
import { AvatarStack, SpaceGlyph } from './chat-primitives'
import {
  SpaceAppSurface,
  SpaceKernelControls,
  useSpaceRuntime,
  type SpaceSurfaceMember,
} from './space-runtime'

export function SpacePage({ roomId }: { roomId: string }) {
  const { t, locale } = useTranslation()
  const {
    state,
    markRoomRead,
    sendMessage,
    requestSpaceAgent,
    sendAttachment,
    editMessage,
    deleteMessage,
    setTyping,
    retryMessage,
    toggleReaction,
    toggleRoomMuted,
    toggleRoomPinned,
  } = useChat()
  const [reloadKey, setReloadKey] = useState(0)
  const room = state.rooms.find((candidate) => candidate.id === roomId)
  const space = state.spaces.find((candidate) => candidate.id === room?.spaceId)
  const runtime = useSpaceRuntime(roomId)
  const messages = useMemo(() => getRoomMessages(state, roomId), [roomId, state])

  useEffect(() => {
    markRoomRead(roomId)
  }, [markRoomRead, roomId])

  useEffect(() => () => setTyping(roomId, false), [roomId, setTyping])

  const onChatCommand = useCallback(async (request: SpaceAppBridgeRequest) => {
    const payload = request.payload
    switch (request.action) {
      case 'chat.send': {
        const text = requiredText(payload.text, 4_000)
        const replyToId = optionalId(payload.replyToId)
        const eventId = await sendMessage(roomId, text, replyToId)
        await requestSpaceAgent(roomId, eventId, text)
        return { eventId }
      }
      case 'chat.attach': {
        const file = payload.file
        if (!(file instanceof File)) throw new Error('CHAT_ATTACHMENT_INVALID')
        return { eventId: await sendAttachment(roomId, file) }
      }
      case 'chat.edit':
        return editMessage(requiredId(payload.messageId), requiredText(payload.text, 4_000))
      case 'chat.delete':
        return deleteMessage(requiredId(payload.messageId))
      case 'chat.reaction.toggle':
        return toggleReaction(requiredId(payload.messageId), requiredText(payload.emoji, 32))
      case 'chat.retry':
        return retryMessage(requiredId(payload.messageId))
      case 'chat.typing':
        setTyping(roomId, payload.isTyping === true)
        return { ok: true }
      case 'chat.markRead':
        markRoomRead(roomId)
        return { ok: true }
      default:
        throw new Error('CHAT_COMMAND_UNSUPPORTED')
    }
  }, [
    deleteMessage,
    editMessage,
    markRoomRead,
    requestSpaceAgent,
    retryMessage,
    roomId,
    sendAttachment,
    sendMessage,
    setTyping,
    toggleReaction,
  ])

  if (!room || !space) {
    return (
      <section className="vc-room-missing">
        <h1>{t.chatApp.space.notFound}</h1>
        <p>{t.chatApp.space.notFoundDescription}</p>
        <Link to="/spaces" className="vc-button vc-button-primary">
          {t.actions.back}
        </Link>
      </section>
    )
  }

  const members = room.memberIds
    .map((id) => state.people.find((person) => person.id === id))
    .filter((person): person is NonNullable<typeof person> => Boolean(person))
  const currentUser = state.people.find((person) => person.id === state.currentUserId)
  if (currentUser && !members.some((member) => member.id === currentUser.id)) members.unshift(currentUser)

  const surfaceMembers: SpaceSurfaceMember[] = members.map((member) => ({
    id: member.id,
    clientId: member.id,
    name: member.displayName,
    displayName: member.displayName,
    handle: member.handle,
    initials: member.initials,
    avatarUrl: member.avatarUrl,
    color: member.color,
    presence: member.presence,
  }))
  const self = surfaceMembers.find((member) => member.id === state.currentUserId)
    ?? surfaceMembers[0]

  if (!self) {
    return <section className="vc-room-missing"><h1>{t.chatApp.space.notFound}</h1></section>
  }

  return (
    <section
      className="vc-live-space"
      data-testid="space-canvas"
      style={{
        '--room-accent': space.accent,
        '--room-canvas': space.canvas,
      } as CSSProperties}
    >
      <header className="vc-kernel-bar" data-testid="space-kernel-bar">
        <Link to="/spaces" className="vc-kernel-icon" aria-label={t.chatApp.space.backToSpaces}>
          <ArrowLeft size={17} />
        </Link>
        <span className="vc-kernel-divider" />
        <SpaceGlyph space={space} />
        <span className="vc-kernel-title">
          <strong>{room.name}</strong>
          <small><i /> {t.chatApp.space.connected}</small>
        </span>
        <span className="vc-kernel-members">
          <AvatarStack people={members} limit={3} />
          <UsersRound size={14} />
          {members.length}
        </span>
        <SpaceKernelControls
          runtime={runtime}
          onReload={() => setReloadKey((current) => current + 1)}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="vc-kernel-icon" aria-label={t.chatApp.space.spaceMenu}>
              <MoreHorizontal size={18} />
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
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => markRoomRead(room.id)}>
              <CheckCheck />
              {t.chatApp.spaces.markRead}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <main className="vc-live-app-stage">
        <SpaceAppSurface
          roomId={room.id}
          appUrl={runtime.appUrl}
          reloadKey={reloadKey}
          snapshot={runtime.snapshot}
          runtimeEvent={runtime.runtimeEvent}
          locale={locale}
          meta={{
            id: space.id,
            name: room.name,
            summary: space.summary,
            icon: space.icon,
            accent: space.accent,
          }}
          self={self}
          members={surfaceMembers}
          messages={messages}
          typingMemberIds={(state.typingUserIdsByRoom[room.id] || []).filter(
            (memberId) => memberId !== state.currentUserId,
          )}
          onChatCommand={onChatCommand}
          unavailable={runtime.unavailable}
          onRetry={() => void runtime.refresh()}
        />
      </main>
    </section>
  )
}

function requiredId(value: unknown) {
  if (typeof value !== 'string' || !value || value.length > 255) {
    throw new Error('CHAT_MESSAGE_ID_INVALID')
  }
  return value
}

function optionalId(value: unknown) {
  return value === undefined || value === null ? undefined : requiredId(value)
}

function requiredText(value: unknown, maximumLength: number) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximumLength) {
    throw new Error('CHAT_TEXT_INVALID')
  }
  return value.trim()
}
