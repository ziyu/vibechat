'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronDown,
  CornerUpLeft,
  ImagePlus,
  MoreHorizontal,
  Pin,
  PinOff,
  Send,
  SmilePlus,
  Volume2,
  VolumeX,
  UsersRound,
  X,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@libs/react-shared/ui/dropdown-menu'
import { formatMessageTime, getRoomMessages } from '@libs/chat'
import { useTranslation } from '@/hooks/use-translation'
import { useChatDemo } from './chat-store'
import { ConversationRail } from './conversation-rail'
import { AvatarStack, PersonAvatar, SpaceGlyph } from './chat-primitives'

const quickReactions = ['♥', '✨', '🌙']

export function RoomPage({ roomId }: { roomId: string }) {
  const { t, locale } = useTranslation()
  const {
    state,
    mode,
    markRoomRead,
    sendMessage,
    toggleReaction,
    toggleRoomMuted,
    toggleRoomPinned,
  } = useChatDemo()
  const [draft, setDraft] = useState('')
  const [replyToId, setReplyToId] = useState<string>()
  const [controlsVisible, setControlsVisible] = useState(true)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [sendError, setSendError] = useState(false)
  const timelineRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const room = state.rooms.find((candidate) => candidate.id === roomId)
  const space = state.spaces.find((candidate) => candidate.id === room?.spaceId)
  const messages = useMemo(() => getRoomMessages(state, roomId), [roomId, state])

  useEffect(() => {
    markRoomRead(roomId)
  }, [markRoomRead, roomId])

  useEffect(() => {
    const timer = window.setTimeout(() => setControlsVisible(false), 3000)
    return () => window.clearTimeout(timer)
  }, [roomId])

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setControlsVisible(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    timelineRef.current?.scrollTo({
      top: timelineRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages.length])

  if (!room || !space) {
    return (
      <div className="vc-room-layout">
        <ConversationRail />
        <section className="vc-room-missing">
          <h1>{t.chatApp.room.notFound}</h1>
          <p>{t.chatApp.room.notFoundDescription}</p>
          <Link to="/$lang/messages" params={{ lang: locale }} className="vc-button vc-button-primary">
            {t.actions.back}
          </Link>
        </section>
      </div>
    )
  }

  const members = room.memberIds
    .map((id) => state.people.find((person) => person.id === id))
    .filter((person): person is NonNullable<typeof person> => !!person)
  const replyMessage = messages.find((message) => message.id === replyToId)
  const replyPerson = state.people.find((person) => person.id === replyMessage?.senderId)

  const submit = () => {
    if (!draft.trim()) return
    setSendError(false)
    void sendMessage(room.id, draft, replyToId).catch(() => setSendError(true))
    setDraft('')
    setReplyToId(undefined)
  }

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  const onFileSelected = (file?: File) => {
    if (!file) return
    const fallback = t.chatApp.room.attachmentFallback.replace('{name}', file.name)
    setSendError(false)
    void sendMessage(room.id, fallback).catch(() => setSendError(true))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="vc-room-layout">
      <ConversationRail activeRoomId={room.id} />

      <section
        className="vc-room-canvas"
        data-testid="atmosphere-canvas"
        data-light={space.id === 'space-postcard' || undefined}
        style={
          {
            '--room-accent': space.accent,
            '--room-canvas': space.canvas,
          } as CSSProperties
        }
        onMouseMove={(event) => {
          if (event.clientY < 92) setControlsVisible(true)
        }}
      >
        <div className="vc-atmosphere-texture" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>

        <header
          className="vc-control-island"
          data-visible={controlsVisible || undefined}
          data-testid="room-control-island"
          onFocus={() => setControlsVisible(true)}
        >
          <Link
            to="/$lang/messages"
            params={{ lang: locale }}
            className="vc-control-icon"
            aria-label={t.chatApp.room.backToMessages}
          >
            <ArrowLeft size={17} />
          </Link>
          <span className="vc-control-divider" />
          <SpaceGlyph space={space} />
          <span className="vc-control-title">
            <strong>{room.name}</strong>
            <small>
              <i /> {t.chatApp.room.connected}
            </small>
          </span>
          <button type="button" className="vc-control-members" onClick={() => setControlsVisible(true)}>
            <AvatarStack people={members} limit={3} />
            <span>{members.length}</span>
            <UsersRound size={15} />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="vc-control-icon" aria-label={t.chatApp.room.roomMenu}>
                <MoreHorizontal size={18} />
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
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <CheckCheck />
                {t.chatApp.room.recoveryView}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            className="vc-control-collapse"
            onClick={() => setControlsVisible(false)}
            aria-label={t.chatApp.room.hideControls}
          >
            <ChevronDown size={15} />
          </button>
        </header>

        <button
          type="button"
          className="vc-control-reveal"
          onClick={() => setControlsVisible(true)}
          aria-label={t.chatApp.room.showControls}
        >
          <span />
        </button>

        <div className="vc-room-intro">
          <SpaceGlyph space={space} />
          <span>{space.name}</span>
          <small>{mode === 'matrix' ? t.chatApp.room.matrixSpace : t.chatApp.room.fixtureSpace}</small>
        </div>

        <div className="vc-timeline" ref={timelineRef} data-testid="message-timeline">
          <div className="vc-timeline-inner">
            <div className="vc-room-opening">
              <span>{space.icon}</span>
              <h1>{room.name}</h1>
              <p>{space.summary}</p>
              <div>
                <AvatarStack people={members} limit={5} />
                <small>
                  {t.chatApp.room.memberCount.replace('{count}', members.length.toString())}
                </small>
              </div>
            </div>

            {messages.map((message, index) => {
              const sender = state.people.find((person) => person.id === message.senderId)!
              const own = message.senderId === state.currentUserId
              const previous = messages[index - 1]
              const grouped = previous?.senderId === message.senderId
              const repliedMessage = messages.find((candidate) => candidate.id === message.replyToId)
              const repliedPerson = state.people.find(
                (person) => person.id === repliedMessage?.senderId,
              )

              return (
                <article
                  key={message.id}
                  className="vc-message"
                  data-own={own || undefined}
                  data-grouped={grouped || undefined}
                  data-testid="chat-message"
                >
                  {!grouped ? <PersonAvatar person={sender} size="sm" /> : <span />}
                  <div className="vc-message-main">
                    {!grouped ? (
                      <header>
                        <strong>{sender.displayName}</strong>
                        <time dateTime={message.createdAt}>
                          {formatMessageTime(message.createdAt, locale)}
                        </time>
                      </header>
                    ) : null}
                    <div className="vc-message-bubble">
                      {repliedMessage ? (
                        <blockquote>
                          <strong>{repliedPerson?.displayName}</strong>
                          <span>{repliedMessage.text}</span>
                        </blockquote>
                      ) : null}
                      <p data-testid="message-body">{message.text}</p>
                      {own ? (
                        <small className="vc-delivery-status">
                          {message.status === 'sending' ? (
                            t.chatApp.room.sending
                          ) : (
                            <>
                              <Check size={11} /> {t.chatApp.room.sent}
                            </>
                          )}
                        </small>
                      ) : null}
                      <div className="vc-message-actions">
                        <button
                          type="button"
                          onClick={() => setReplyToId(message.id)}
                          aria-label={t.chatApp.room.reply}
                        >
                          <CornerUpLeft size={14} />
                        </button>
                        {quickReactions.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => toggleReaction(message.id, emoji)}
                            aria-label={`${t.chatApp.room.react} ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                    {message.reactions.length ? (
                      <div className="vc-reactions">
                        {message.reactions.map((reaction) => (
                          <button
                            key={reaction.emoji}
                            type="button"
                            data-reacted={reaction.userIds.includes(state.currentUserId) || undefined}
                            onClick={() => toggleReaction(message.id, reaction.emoji)}
                          >
                            {reaction.emoji} <span>{reaction.userIds.length}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        </div>

        <footer className="vc-composer-wrap">
          {replyMessage ? (
            <div className="vc-reply-preview" data-testid="reply-preview">
              <CornerUpLeft size={14} />
              <span>
                <small>{t.chatApp.room.replyingTo.replace('{name}', replyPerson?.displayName ?? '')}</small>
                <strong>{replyMessage.text}</strong>
              </span>
              <button type="button" onClick={() => setReplyToId(undefined)} aria-label={t.actions.cancel}>
                <X size={14} />
              </button>
            </div>
          ) : null}
          {emojiOpen ? (
            <div className="vc-emoji-tray" aria-label={t.chatApp.room.emoji}>
              {['🌙', '✨', '♥', '☕', '🎧'].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  aria-label={`${t.chatApp.room.emoji} ${emoji}`}
                  onClick={() => {
                    setDraft((current) => `${current}${emoji}`)
                    setEmojiOpen(false)
                    composerRef.current?.focus()
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : null}
          <div className="vc-composer">
            <input
              ref={fileInputRef}
              type="file"
              hidden
              onChange={(event) => onFileSelected(event.target.files?.[0])}
            />
            <button
              type="button"
              className="vc-composer-icon"
              onClick={() => fileInputRef.current?.click()}
              aria-label={t.chatApp.room.attach}
            >
              <ImagePlus size={18} />
            </button>
            <textarea
              ref={composerRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onComposerKeyDown}
              placeholder={t.chatApp.room.messagePlaceholder}
              rows={1}
              data-testid="message-input"
            />
            <button
              type="button"
              className="vc-composer-icon"
              aria-label={t.chatApp.room.emoji}
              aria-expanded={emojiOpen}
              onClick={() => setEmojiOpen((current) => !current)}
            >
              <SmilePlus size={18} />
            </button>
            <button
              type="button"
              className="vc-send-button"
              disabled={!draft.trim()}
              onClick={submit}
              aria-label={t.chatApp.room.send}
              data-testid="send-message"
            >
              <Send size={17} />
            </button>
          </div>
          <small className="vc-composer-hint">{t.chatApp.room.composerHint}</small>
          {sendError ? <small role="alert">{t.chatApp.room.sendFailed}</small> : null}
        </footer>
      </section>
    </div>
  )
}
