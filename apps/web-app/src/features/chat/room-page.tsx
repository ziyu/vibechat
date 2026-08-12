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
  FileText,
  ImagePlus,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Send,
  SmilePlus,
  Trash2,
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
} from '@vibechat/react-shared/ui/dropdown-menu'
import { formatMessageTime, getRoomMessages } from '@vibechat/product-core'
import { useTranslation } from '@/hooks/use-translation'
import { useChat } from './chat-store'
import { ConversationRail } from './conversation-rail'
import { AvatarStack, PersonAvatar, SpaceGlyph } from './chat-primitives'

const quickReactions = ['♥', '✨', '🌙']

export function RoomPage({ roomId }: { roomId: string }) {
  const { t, locale } = useTranslation()
  const {
    state,
    markRoomRead,
    sendMessage,
    sendAttachment,
    editMessage,
    deleteMessage,
    setTyping,
    retryMessage,
    toggleReaction,
    toggleRoomMuted,
    toggleRoomPinned,
  } = useChat()
  const [draft, setDraft] = useState('')
  const [replyToId, setReplyToId] = useState<string>()
  const [editingMessageId, setEditingMessageId] = useState<string>()
  const [controlsVisible, setControlsVisible] = useState(true)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [sendError, setSendError] = useState(false)
  const timelineRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const typingTimerRef = useRef<number | undefined>(undefined)
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

  useEffect(() => () => {
    window.clearTimeout(typingTimerRef.current)
    setTyping(roomId, false)
  }, [roomId, setTyping])

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
  const typingPeople = (state.typingUserIdsByRoom[room.id] || [])
    .map((userId) => state.people.find((person) => person.id === userId))
    .filter((person): person is NonNullable<typeof person> => !!person)

  const submit = () => {
    if (!draft.trim()) return
    setSendError(false)
    const text = draft.trim()
    if (editingMessageId) {
      void editMessage(editingMessageId, text).catch(() => setSendError(true))
      setEditingMessageId(undefined)
    } else {
      void sendMessage(room.id, text, replyToId).catch(() => setSendError(true))
    }
    setTyping(room.id, false)
    window.clearTimeout(typingTimerRef.current)
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
    setSendError(false)
    void sendAttachment(room.id, file).catch(() => setSendError(true))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const onDraftChange = (value: string) => {
    setDraft(value)
    window.clearTimeout(typingTimerRef.current)
    if (!value.trim()) {
      setTyping(room.id, false)
      return
    }
    setTyping(room.id, true)
    typingTimerRef.current = window.setTimeout(() => setTyping(room.id, false), 3_500)
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
          <small>{t.chatApp.room.matrixSpace}</small>
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
                      {message.attachment ? (
                        <a
                          className="vc-message-attachment"
                          href={message.attachment.downloadUrl}
                          download={message.attachment.name}
                          data-testid="message-attachment"
                        >
                          {message.attachment.kind === 'image' && message.attachment.downloadUrl ? (
                            <img src={message.attachment.downloadUrl} alt={message.attachment.name} />
                          ) : <FileText size={18} />}
                          <span>
                            <strong>{message.attachment.name}</strong>
                            <small>
                              {message.attachment.mimeType} · {Math.ceil(message.attachment.size / 1024)} KB
                            </small>
                          </span>
                        </a>
                      ) : null}
                      <p data-testid="message-body">
                        {message.deleted ? t.chatApp.room.deletedMessage : message.text}
                      </p>
                      {message.edited && !message.deleted ? (
                        <small className="vc-edited-label">{t.chatApp.room.edited}</small>
                      ) : null}
                      {own ? (
                        <small className="vc-delivery-status">
                          {message.status === 'sending'
                            ? t.chatApp.room.sending
                            : message.status === 'failed'
                              ? (
                                <button
                                  type="button"
                                  onClick={() => void retryMessage(message.id).catch(() => setSendError(true))}
                                  data-testid="retry-message"
                                >
                                  {t.chatApp.room.retryFailed}
                                </button>
                              )
                              : (
                            <>
                              <Check size={11} /> {t.chatApp.room.sent}
                            </>
                              )}
                        </small>
                      ) : null}
                      {!message.deleted ? <div className="vc-message-actions">
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
                            onClick={() => void toggleReaction(message.id, emoji).catch(() => setSendError(true))}
                            aria-label={`${t.chatApp.room.react} ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                        {own ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setReplyToId(undefined)
                                setEditingMessageId(message.id)
                                setDraft(message.text)
                                composerRef.current?.focus()
                              }}
                              aria-label={t.chatApp.room.editMessage}
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(t.chatApp.room.deleteMessageConfirm)) {
                                  void deleteMessage(message.id).catch(() => setSendError(true))
                                }
                              }}
                              aria-label={t.chatApp.room.deleteMessage}
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        ) : null}
                      </div> : null}
                    </div>
                    {message.reactions.length ? (
                      <div className="vc-reactions">
                        {message.reactions.map((reaction) => (
                          <button
                            key={reaction.emoji}
                            type="button"
                            data-reacted={reaction.userIds.includes(state.currentUserId) || undefined}
                            onClick={() => void toggleReaction(message.id, reaction.emoji).catch(() => setSendError(true))}
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
          {editingMessageId ? (
            <div className="vc-reply-preview" data-testid="edit-preview">
              <Pencil size={14} />
              <span>
                <small>{t.chatApp.room.editingMessage}</small>
                <strong>{draft}</strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditingMessageId(undefined)
                  setDraft('')
                }}
                aria-label={t.actions.cancel}
              >
                <X size={14} />
              </button>
            </div>
          ) : null}
          {typingPeople.length ? (
            <div className="vc-typing-indicator" data-testid="typing-indicator">
              <span><i /><i /><i /></span>
              {t.chatApp.room.typing.replace(
                '{names}',
                typingPeople.map((person) => person.displayName).join('、'),
              )}
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
              data-testid="attachment-input"
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
              onChange={(event) => onDraftChange(event.target.value)}
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
