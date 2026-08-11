import {
  ClientEvent,
  createClient,
  EventStatus,
  EventType,
  IndexedDBStore,
  MatrixScheduler,
  MsgType,
  PendingEventOrdering,
  RelationType,
  RoomEvent,
  SyncState,
  type MatrixClient,
  type MatrixEvent,
  type Room,
} from 'matrix-js-sdk'
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events'
import type {
  ChatDemoState,
  ChatMessage,
  ChatPerson,
  ChatReaction,
  ChatRoom,
  FriendRequest,
  RoomBootstrap,
  SessionBootstrap,
} from '@libs/chat'

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
): Promise<MatrixRuntime> {
  const store = new IndexedDBStore({
    indexedDB: window.indexedDB,
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
) {
  const content = (replyToId ? {
    msgtype: MsgType.Text,
    body: text,
    'm.relates_to': {
      'm.in_reply_to': { event_id: replyToId },
    },
  } : {
    msgtype: MsgType.Text,
    body: text,
  }) as RoomMessageEventContent
  return client.sendEvent(
    roomId,
    EventType.RoomMessage,
    content,
    transactionId,
  )
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

export function subscribeToMatrixProjection(
  client: MatrixClient,
  onUpdate: () => void,
  onSyncState: (state: SyncState) => void,
) {
  const handleSync = (state: SyncState) => {
    onSyncState(state)
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

  return () => {
    client.removeListener(ClientEvent.Sync, handleSync)
    client.removeListener(RoomEvent.Timeline, handleTimeline)
    client.removeListener(RoomEvent.LocalEchoUpdated, handleRoomChange)
    client.removeListener(RoomEvent.Name, handleRoomChange)
    client.removeListener(RoomEvent.MyMembership, handleRoomChange)
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

function projectPerson(userId: string, displayName?: string): ChatPerson {
  const localpart = userId.startsWith('@') ? userId.slice(1).split(':')[0] : userId
  const name = displayName || localpart || userId
  return {
    id: userId,
    handle: userId,
    displayName: name,
    initials: initialsForName(name),
    color: colorForUser(userId),
    presence: 'offline',
    bio: '',
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

function projectRoomMessages(room: Room, pendingTransactionIds: ReadonlySet<string>) {
  const events = room.getLiveTimeline().getEvents()
  const reactions = new Map<string, Map<string, Set<string>>>()

  for (const event of events) {
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
    if (event.getType() !== EventType.RoomMessage || event.isRedacted()) return []
    const content = event.getContent<Record<string, unknown>>()
    if (content.msgtype !== 'm.text' || typeof content.body !== 'string') return []
    const id = event.getId() || event.getTxnId()
    const sender = event.getSender()
    if (!id || !sender) return []
    const eventReactions: ChatReaction[] = [...(reactions.get(id)?.entries() || [])]
      .map(([emoji, users]) => ({ emoji, userIds: [...users] }))

    return [{
      id,
      transactionId: event.getTxnId(),
      roomId: room.roomId,
      senderId: sender,
      text: content.body,
      createdAt: new Date(event.getTs()).toISOString(),
      status: messageStatus(event, pendingTransactionIds),
      replyToId: replyEventId(event),
      reactions: eventReactions,
    }]
  })
}

function roomSpaceId(room: Room) {
  const event = room.currentState.getStateEvents(VIBE_SPACE_STATE_EVENT, '')
  const spaceId = event?.getContent<Record<string, unknown>>().spaceId
  return typeof spaceId === 'string' ? spaceId : null
}

export function projectMatrixChatState(
  client: MatrixClient,
  baseState: ChatDemoState,
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
): ChatDemoState {
  const people = new Map<string, ChatPerson>()
  for (const person of social?.people || []) people.set(person.id, person)
  people.set(profile.id, projectPerson(profile.id, profile.displayName))
  people.set(client.getUserId()!, projectPerson(client.getUserId()!, profile.displayName))

  const messages: ChatMessage[] = []
  const rooms: ChatRoom[] = []
  for (const room of client.getRooms()) {
    const membership = room.getMyMembership()
    if (membership !== 'join' && membership !== 'invite') continue
    const spaceId = roomSpaceId(room) || roomMetadata[room.roomId]?.spaceId || null
    if (!spaceId || !baseState.spaces.some((space) => space.id === spaceId)) continue

    for (const member of room.getJoinedMembers()) {
      people.set(member.userId, projectPerson(member.userId, member.name))
    }
    const roomMessages = membership === 'join'
      ? projectRoomMessages(room, pendingTransactionIds)
      : []
    messages.push(...roomMessages)
    const lastMessage = roomMessages.at(-1)
    const preferences = roomPreferences[room.roomId] || {}
    rooms.push({
      id: room.roomId,
      name: room.name,
      memberIds: Array.from(new Set([
        ...room.getJoinedMembers().map((member) => member.userId),
        client.getUserId()!,
      ])),
      spaceId,
      lastMessage: lastMessage?.text || '',
      updatedAt: lastMessage?.createdAt || new Date(room.getLiveTimeline().getEvents().at(-1)?.getTs() || 0).toISOString(),
      unreadCount: room.getUnreadNotificationCount(),
      pinned: preferences.pinned || false,
      muted: preferences.muted || false,
      membership,
    })
  }

  return {
    ...baseState,
    currentUserId: client.getUserId()!,
    people: [...people.values()],
    contactIds: social?.contactIds || [],
    friendRequests: social?.friendRequests || [],
    blockedUserIds: social?.blockedUserIds || [],
    rooms,
    messages,
  }
}

export { ClientEvent, EventType, RoomEvent, SyncState }
