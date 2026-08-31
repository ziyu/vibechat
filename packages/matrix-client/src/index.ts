import {
  ClientEvent,
  EventTimeline,
  createClient,
  EventStatus,
  EventType,
  IndexedDBStore,
  MatrixScheduler,
  MsgType,
  PendingEventOrdering,
  RelationType,
  RoomEvent,
  RoomMemberEvent,
  SyncState,
  UserEvent,
  type MatrixClient,
  type MatrixEvent,
  type Room,
  type SyncStateData,
} from 'matrix-js-sdk'
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events'
import type {
  ChatState,
  ChatMessage,
  ChatMessagePage,
  ChatPerson,
  ChatReaction,
  ChatRoom,
  FriendRequest,
} from '@vibechat/product-core'
import {
  type RoomBootstrap,
  type SessionBootstrap,
  type SpaceAgentMention,
} from '@vibechat/api-contracts'
import {
  matrixAgentMemberMetadata,
  matrixAgentReplyMetadata,
} from './agent-identity'
import { createMatrixTextContent } from './message-content'
import { spaceIdFromStateContent } from './space-state'

export const VIBE_SPACE_STATE_EVENT = 'io.vibechat.space.instance.v1'

export interface MatrixRuntime {
  client: MatrixClient
  store: IndexedDBStore
  stop: () => Promise<void>
  clear: () => Promise<void>
}

type ReadyMatrixBootstrap = Extract<SessionBootstrap['matrix'], { status: 'ready' }>

export async function createMatrixRuntime(
  matrix: ReadyMatrixBootstrap,
  options: { indexedDB: IDBFactory },
): Promise<MatrixRuntime> {
  const store = new IndexedDBStore({
    indexedDB: options.indexedDB,
    dbName: `vibechat-sync-${matrix.deviceId}`,
  })
  const client = createClient({
    baseUrl: matrix.homeserverUrl,
    accessToken: matrix.accessToken,
    userId: matrix.userId,
    deviceId: matrix.deviceId,
    store,
    scheduler: new MatrixScheduler(),
    timelineSupport: true,
    useAuthorizationHeader: true,
  })

  await store.startup()
  client.startClient({
    initialSyncLimit: 30,
    lazyLoadMembers: true,
    pendingEventOrdering: PendingEventOrdering.Detached,
  })

  return {
    client,
    store,
    stop: async () => {
      client.stopClient()
      await store.save(true).catch(() => undefined)
    },
    clear: async () => {
      client.stopClient()
      await store.deleteAllData()
    },
  }
}

export function sendMatrixText(
  client: MatrixClient,
  roomId: string,
  text: string,
  transactionId: string,
  replyToId?: string,
  agentMentions: SpaceAgentMention[] = [],
  memberMentionIds: string[] = [],
) {
  const room = client.getRoom(roomId)
  const pendingEvent = room?.getPendingEvents().find(
    (event) => event.getTxnId() === transactionId,
  )
  if (room && pendingEvent) return client.resendEvent(pendingEvent, room)

  const content = createMatrixTextContent(
    text,
    replyToId,
    agentMentions,
    memberMentionIds,
  )
  return client.sendEvent(
    roomId,
    EventType.RoomMessage,
    content,
    transactionId,
  )
}

export async function loadMatrixRoomMessages(
  client: MatrixClient,
  roomId: string,
  options: { limit?: number; before?: string } = {},
  pendingTransactionIds: ReadonlySet<string> = new Set(),
): Promise<ChatMessagePage> {
  const room = client.getRoom(roomId)
  if (!room || room.getMyMembership() !== 'join') {
    throw new Error('MATRIX_ROOM_NOT_JOINED')
  }
  const limit = options.limit ?? 20
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new Error('CHAT_HISTORY_LIMIT_INVALID')
  }

  let messages = projectRoomMessages(client, room, pendingTransactionIds)
  let beforeIndex = options.before
    ? messages.findIndex((message) => message.id === options.before)
    : messages.length
  if (options.before && beforeIndex < 0) {
    throw new Error('CHAT_HISTORY_CURSOR_INVALID')
  }

  for (let attempt = 0; options.before && beforeIndex === 0 && attempt < 3; attempt += 1) {
    if (!room.getLiveTimeline().getPaginationToken(EventTimeline.BACKWARDS)) break
    await client.scrollback(room, limit)
    messages = projectRoomMessages(client, room, pendingTransactionIds)
    beforeIndex = messages.findIndex((message) => message.id === options.before)
    if (beforeIndex < 0) throw new Error('CHAT_HISTORY_CURSOR_INVALID')
  }

  const end = options.before ? beforeIndex : messages.length
  const start = Math.max(0, end - limit)
  const page = messages.slice(start, end)
  const hasMore = start > 0
    || Boolean(room.getLiveTimeline().getPaginationToken(EventTimeline.BACKWARDS))
  return {
    messages: page,
    nextBefore: hasMore ? page[0]?.id ?? options.before ?? null : null,
    hasMore,
  }
}

export function sendMatrixReaction(
  client: MatrixClient,
  roomId: string,
  eventId: string,
  emoji: string,
  transactionId: string,
) {
  return client.sendEvent(roomId, EventType.Reaction, {
    'm.relates_to': {
      rel_type: RelationType.Annotation,
      event_id: eventId,
      key: emoji,
    },
  }, transactionId)
}

export async function toggleMatrixReaction(
  client: MatrixClient,
  roomId: string,
  eventId: string,
  emoji: string,
  transactionId: string,
) {
  const ownReaction = client.getRoom(roomId)?.getLiveTimeline().getEvents().find((event) => {
    if (event.getType() !== EventType.Reaction || event.isRedacted()) return false
    const relation = event.getContent<Record<string, unknown>>()['m.relates_to']
    if (!relation || typeof relation !== 'object') return false
    const record = relation as Record<string, unknown>
    return event.getSender() === client.getUserId()
      && record.rel_type === RelationType.Annotation
      && record.event_id === eventId
      && record.key === emoji
  })
  const reactionEventId = ownReaction?.getId()
  if (reactionEventId) {
    await client.redactEvent(roomId, reactionEventId, transactionId)
    return
  }
  await sendMatrixReaction(client, roomId, eventId, emoji, transactionId)
}

export function editMatrixText(
  client: MatrixClient,
  roomId: string,
  eventId: string,
  text: string,
  transactionId: string,
) {
  return client.sendEvent(roomId, EventType.RoomMessage, {
    msgtype: MsgType.Text,
    body: `* ${text}`,
    'm.new_content': { msgtype: MsgType.Text, body: text },
    'm.relates_to': {
      rel_type: RelationType.Replace,
      event_id: eventId,
    },
  }, transactionId)
}

export function redactMatrixEvent(
  client: MatrixClient,
  roomId: string,
  eventId: string,
  transactionId: string,
) {
  return client.redactEvent(roomId, eventId, transactionId)
}

export async function sendMatrixMedia(
  client: MatrixClient,
  roomId: string,
  file: File,
  transactionId: string,
) {
  const uploaded = await client.uploadContent(file, {
    name: file.name,
    type: file.type || 'application/octet-stream',
  })
  const content = {
    msgtype: file.type.startsWith('image/') ? MsgType.Image : MsgType.File,
    body: file.name,
    url: uploaded.content_uri,
    info: {
      mimetype: file.type || 'application/octet-stream',
      size: file.size,
    },
  } as RoomMessageEventContent
  return client.sendEvent(roomId, EventType.RoomMessage, content, transactionId)
}

export function setMatrixTyping(client: MatrixClient, roomId: string, isTyping: boolean) {
  return client.sendTyping(roomId, isTyping, isTyping ? 5_000 : 0)
}

export function subscribeToMatrixProjection(
  client: MatrixClient,
  onUpdate: () => void,
  onSyncState: (state: SyncState, data?: SyncStateData) => void,
) {
  const handleSync = (
    state: SyncState,
    _previousState: SyncState | null,
    data?: SyncStateData,
  ) => {
    onSyncState(state, data)
    if (state === SyncState.Prepared || state === SyncState.Syncing) onUpdate()
  }
  const handleTimeline = (
    _event: MatrixEvent,
    _room: Room | undefined,
    toStartOfTimeline: boolean | undefined,
  ) => {
    if (!toStartOfTimeline) onUpdate()
  }
  const handleRoomChange = () => onUpdate()

  client.on(ClientEvent.Sync, handleSync)
  client.on(RoomEvent.Timeline, handleTimeline)
  client.on(RoomEvent.LocalEchoUpdated, handleRoomChange)
  client.on(RoomEvent.Name, handleRoomChange)
  client.on(RoomEvent.MyMembership, handleRoomChange)
  client.on(RoomMemberEvent.Typing, handleRoomChange)
  client.on(UserEvent.Presence, handleRoomChange)
  client.on(UserEvent.AvatarUrl, handleRoomChange)
  client.on(UserEvent.DisplayName, handleRoomChange)

  return () => {
    client.removeListener(ClientEvent.Sync, handleSync)
    client.removeListener(RoomEvent.Timeline, handleTimeline)
    client.removeListener(RoomEvent.LocalEchoUpdated, handleRoomChange)
    client.removeListener(RoomEvent.Name, handleRoomChange)
    client.removeListener(RoomEvent.MyMembership, handleRoomChange)
    client.removeListener(RoomMemberEvent.Typing, handleRoomChange)
    client.removeListener(UserEvent.Presence, handleRoomChange)
    client.removeListener(UserEvent.AvatarUrl, handleRoomChange)
    client.removeListener(UserEvent.DisplayName, handleRoomChange)
  }
}

function colorForUser(userId: string) {
  const colors = ['#e4472f', '#256b5d', '#7258a6', '#b7652f', '#356b94', '#9b4f53']
  let hash = 0
  for (const character of userId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  return colors[hash % colors.length]
}

function initialsForName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return parts.slice(0, 2).map((part) => [...part][0]).join('').toUpperCase()
}

function projectPerson(
  client: MatrixClient,
  userId: string,
  displayName?: string,
  productAvatarUrl?: string | null,
): ChatPerson {
  const localpart = userId.startsWith('@') ? userId.slice(1).split(':')[0] : userId
  const matrixUser = client.getUser(userId)
  const name = displayName || matrixUser?.displayName || localpart || userId
  const matrixAvatarUrl = matrixUser?.avatarUrl
  return {
    id: userId,
    avatarUrl: productAvatarUrl
      || (matrixAvatarUrl ? client.mxcUrlToHttp(matrixAvatarUrl) : null),
    handle: userId,
    displayName: name,
    initials: initialsForName(name),
    color: colorForUser(userId),
    presence: matrixUser?.presence === 'online'
      ? 'online'
      : matrixUser?.presence === 'unavailable'
        ? 'away'
        : 'offline',
    bio: matrixUser?.presenceStatusMsg || '',
  }
}

function messageStatus(
  event: MatrixEvent,
  pendingTransactionIds: ReadonlySet<string>,
): ChatMessage['status'] {
  if (event.getTxnId() && pendingTransactionIds.has(event.getTxnId()!)) return 'sending'
  if (event.getId()?.startsWith('~')) return 'sending'
  switch (event.status) {
    case EventStatus.NOT_SENT:
    case EventStatus.CANCELLED:
      return 'failed'
    case EventStatus.ENCRYPTING:
    case EventStatus.QUEUED:
    case EventStatus.SENDING:
      return 'sending'
    default:
      return 'sent'
  }
}

function replyEventId(event: MatrixEvent) {
  const relatesTo = event.getContent<Record<string, unknown>>()['m.relates_to']
  if (!relatesTo || typeof relatesTo !== 'object') return undefined
  const reply = (relatesTo as Record<string, unknown>)['m.in_reply_to']
  if (!reply || typeof reply !== 'object') return undefined
  const eventId = (reply as Record<string, unknown>).event_id
  return typeof eventId === 'string' ? eventId : undefined
}

function mentionedUserIds(content: Record<string, unknown>) {
  const mentions = content['m.mentions']
  if (!mentions || typeof mentions !== 'object') return []
  const userIds = (mentions as Record<string, unknown>).user_ids
  if (!Array.isArray(userIds)) return []
  return [...new Set(userIds.filter(
    (userId): userId is string => typeof userId === 'string' && userId.length > 0,
  ))].slice(0, 50)
}

function roomAgentMatrixUsers(room: Room) {
  const identities = new Map<string, string>()
  for (const member of room.getJoinedMembers()) {
    const memberEvent = room.currentState.getStateEvents(
      EventType.RoomMember,
      member.userId,
    )
    const metadata = matrixAgentMemberMetadata(
      memberEvent?.getContent<Record<string, unknown>>(),
    )
    if (metadata) identities.set(member.userId, metadata.agentId)
  }

  // Backward compatibility for Agent users that joined before membership
  // metadata was introduced. Agent reply events are already authoritative and
  // bound to their authenticated Matrix sender by the homeserver.
  for (const event of room.getLiveTimeline().getEvents()) {
    if (event.getType() !== EventType.RoomMessage) continue
    const sender = event.getSender()
    const metadata = matrixAgentReplyMetadata(
      event.getContent<Record<string, unknown>>(),
    )
    if (sender && metadata) identities.set(sender, metadata.agentId)
  }
  return identities
}

function projectRoomMessages(
  client: MatrixClient,
  room: Room,
  pendingTransactionIds: ReadonlySet<string>,
) {
  const events = room.getLiveTimeline().getEvents()
  const reactions = new Map<string, Map<string, Set<string>>>()
  const replacements = new Map<string, { text: string; timestamp: number }>()

  for (const event of events) {
    if (event.getType() === EventType.RoomMessage && !event.isRedacted()) {
      const content = event.getContent<Record<string, unknown>>()
      const relation = content['m.relates_to']
      const newContent = content['m.new_content']
      if (relation && typeof relation === 'object' && newContent && typeof newContent === 'object') {
        const relationRecord = relation as Record<string, unknown>
        const newContentRecord = newContent as Record<string, unknown>
        const targetId = relationRecord.event_id
        const text = newContentRecord.body
        if (
          relationRecord.rel_type === RelationType.Replace
          && typeof targetId === 'string'
          && typeof text === 'string'
        ) {
          const previous = replacements.get(targetId)
          if (!previous || previous.timestamp <= event.getTs()) {
            replacements.set(targetId, { text, timestamp: event.getTs() })
          }
        }
      }
    }
    if (event.getType() !== EventType.Reaction || event.isRedacted()) continue
    const content = event.getContent<Record<string, unknown>>()
    const relation = content['m.relates_to']
    if (!relation || typeof relation !== 'object') continue
    const relationRecord = relation as Record<string, unknown>
    const eventId = relationRecord.event_id
    const key = relationRecord.key
    const sender = event.getSender()
    if (typeof eventId !== 'string' || typeof key !== 'string' || !sender) continue
    const byEmoji = reactions.get(eventId) || new Map<string, Set<string>>()
    const users = byEmoji.get(key) || new Set<string>()
    users.add(sender)
    byEmoji.set(key, users)
    reactions.set(eventId, byEmoji)
  }

  return events.flatMap<ChatMessage>((event) => {
    if (event.getType() !== EventType.RoomMessage) return []
    const content = event.getContent<Record<string, unknown>>()
    const id = event.getId() || event.getTxnId()
    const sender = event.getSender()
    if (!id || !sender) return []
    const relation = content['m.relates_to']
    if (
      relation
      && typeof relation === 'object'
      && (relation as Record<string, unknown>).rel_type === RelationType.Replace
    ) return []
    const deleted = event.isRedacted()
    const messageType = content.msgtype
    const supported = messageType === MsgType.Text
      || messageType === MsgType.Image
      || messageType === MsgType.File
    if (!deleted && (!supported || typeof content.body !== 'string')) return []
    const eventReactions: ChatReaction[] = [...(reactions.get(id)?.entries() || [])]
      .map(([emoji, users]) => ({ emoji, userIds: [...users] }))
    const replacement = replacements.get(id)
    const info = content.info && typeof content.info === 'object'
      ? content.info as Record<string, unknown>
      : {}
    const matrixContentUri = typeof content.url === 'string' ? content.url : undefined
    const agentMetadata = matrixAgentReplyMetadata(content)
    const memberMentions = mentionedUserIds(content)
    const attachment = !deleted
      && (messageType === MsgType.Image || messageType === MsgType.File)
      && matrixContentUri
      ? {
          kind: messageType === MsgType.Image ? 'image' as const : 'file' as const,
          name: content.body as string,
          mimeType: typeof info.mimetype === 'string'
            ? info.mimetype
            : 'application/octet-stream',
          size: typeof info.size === 'number' ? info.size : 0,
          matrixContentUri,
          downloadUrl: client.mxcUrlToHttp(matrixContentUri) || undefined,
        }
      : undefined

    return [{
      id,
      transactionId: event.getTxnId(),
      roomId: room.roomId,
      senderId: agentMetadata?.agentId || sender,
      text: deleted ? '' : replacement?.text || content.body as string,
      createdAt: new Date(event.getTs()).toISOString(),
      status: messageStatus(event, pendingTransactionIds),
      replyToId: replyEventId(event),
      ...(memberMentions.length > 0 ? { mentionedUserIds: memberMentions } : {}),
      ...(agentMetadata ? {
        agent: true,
        agentId: agentMetadata.agentId,
        agentTurnId: agentMetadata.turnId,
        agentSourceEventIds: agentMetadata.sourceEventIds,
      } : {}),
      edited: !!replacement,
      deleted,
      attachment,
      reactions: eventReactions,
    }]
  })
}

function roomSpaceId(room: Room) {
  const event = room.currentState.getStateEvents(VIBE_SPACE_STATE_EVENT, '')
  return spaceIdFromStateContent(event?.getContent<Record<string, unknown>>())
}

export function projectMatrixChatState(
  client: MatrixClient,
  baseState: ChatState,
  profile: SessionBootstrap['user'],
  roomPreferences: Record<string, { pinned?: boolean; muted?: boolean }>,
  pendingTransactionIds: ReadonlySet<string> = new Set(),
  social?: {
    people: ChatPerson[]
    contactIds: string[]
    friendRequests: FriendRequest[]
    blockedUserIds: string[]
  },
  roomMetadata: Record<string, RoomBootstrap> = {},
): ChatState {
  const people = new Map<string, ChatPerson>()
  for (const person of social?.people || []) {
    const liveMatrixPerson = person.matrixUserId
      ? projectPerson(client, person.matrixUserId, person.displayName, person.avatarUrl)
      : null
    const productPerson = liveMatrixPerson ? {
      ...person,
      avatarUrl: person.avatarUrl || liveMatrixPerson.avatarUrl,
      presence: liveMatrixPerson.presence,
      bio: liveMatrixPerson.bio || person.bio,
    } : person
    people.set(person.id, productPerson)
    if (person.matrixUserId) {
      people.set(person.matrixUserId, { ...productPerson, id: person.matrixUserId })
    }
  }
  const currentMatrixUserId = client.getUserId()!
  const currentPerson = {
    ...projectPerson(client, currentMatrixUserId, profile.displayName, profile.avatarUrl),
    matrixUserId: currentMatrixUserId,
    handle: `@${profile.username}`,
  }
  people.set(profile.id, { ...currentPerson, id: profile.id })
  people.set(currentMatrixUserId, currentPerson)

  const messages: ChatMessage[] = []
  const rooms: ChatRoom[] = []
  const typingUserIdsByRoom: Record<string, string[]> = {}
  for (const room of client.getRooms()) {
    const membership = room.getMyMembership()
    if (membership !== 'join' && membership !== 'invite') continue
    const metadata = roomMetadata[room.roomId]
    const spaceId = roomSpaceId(room)
      || metadata?.spaceTemplateId
      || metadata?.spaceId
      || (metadata?.startMode === 'blank' ? 'space-default' : null)
    if (!spaceId || !baseState.spaces.some((space) => space.id === spaceId)) continue

    const joinedMembers = room.getJoinedMembers()
    const agentMatrixUsers = roomAgentMatrixUsers(room)
    const humanMembers = joinedMembers.filter(
      (member) => !agentMatrixUsers.has(member.userId),
    )
    for (const matrixUserId of agentMatrixUsers.keys()) people.delete(matrixUserId)
    for (const member of humanMembers) {
      if (!people.has(member.userId)) {
        people.set(member.userId, projectPerson(client, member.userId, member.name))
      }
    }
    const roomMessages = membership === 'join'
      ? projectRoomMessages(client, room, pendingTransactionIds)
      : []
    typingUserIdsByRoom[room.roomId] = humanMembers
      .filter((member) => member.typing && member.userId !== client.getUserId())
      .map((member) => member.userId)
    messages.push(...roomMessages)
    const lastMessage = roomMessages.at(-1)
    const preferences = roomPreferences[room.roomId] || {}
    rooms.push({
      id: room.roomId,
      name: room.name,
      memberIds: Array.from(new Set([
        ...humanMembers.map((member) => member.userId),
        client.getUserId()!,
      ])),
      spaceId,
      lastMessage: lastMessage?.attachment?.name || lastMessage?.text || '',
      updatedAt: lastMessage?.createdAt || new Date(room.getLiveTimeline().getEvents().at(-1)?.getTs() || 0).toISOString(),
      unreadCount: room.getUnreadNotificationCount(),
      pinned: preferences.pinned || false,
      muted: preferences.muted || false,
      membership,
    })
  }

  // Room membership display names can lag behind the product profile. Keep
  // the current product profile authoritative after projecting room members.
  people.set(currentMatrixUserId, currentPerson)

  return {
    ...baseState,
    currentUserId: client.getUserId()!,
    people: [...people.values()],
    contactIds: social?.contactIds || [],
    friendRequests: social?.friendRequests || [],
    blockedUserIds: social?.blockedUserIds || [],
    typingUserIdsByRoom,
    rooms,
    messages,
  }
}

export { ClientEvent, EventType, RoomEvent, SyncState }
export type { MatrixClient, SyncStateData } from 'matrix-js-sdk'
