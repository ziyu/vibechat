'use client'

import {
  appendMessageToState,
  createChatId,
  createDemoChatState,
  createRoomInState,
  productProfileSchema,
  roomBootstrapSchema,
  roomMetadataLookupResponseSchema,
  sessionBootstrapSchema,
  socialSnapshotSchema,
  userSearchResponseSchema,
  type ChatDemoState,
  type ChatLocale,
  type ChatMessage,
  type ChatPerson,
  type CreateRoomInput,
  type RoomBootstrap,
  type SocialPerson,
} from '@libs/chat'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { MatrixClient, SyncState } from 'matrix-js-sdk'
import type { MatrixRuntime } from './matrix-runtime'

const FIXTURE_STORAGE_KEY = 'vibechat-demo-state-v1'
const UI_PREFERENCES_KEY = 'vibechat-chat-ui-v1'

type ChatDataMode = 'fixture' | 'matrix'
type RoomPreferences = Record<string, { pinned?: boolean; muted?: boolean }>
type MatrixRuntimeModule = typeof import('./matrix-runtime')

interface ChatDemoContextValue {
  state: ChatDemoState
  ready: boolean
  mode: ChatDataMode
  syncState: SyncState | 'FIXTURE' | 'CONNECTING' | 'ERROR'
  markRoomRead: (roomId: string) => void
  toggleRoomPinned: (roomId: string) => void
  toggleRoomMuted: (roomId: string) => void
  sendMessage: (roomId: string, text: string, replyToId?: string) => Promise<string>
  sendAttachment: (roomId: string, file: File) => Promise<string>
  editMessage: (messageId: string, text: string) => Promise<void>
  deleteMessage: (messageId: string) => Promise<void>
  setTyping: (roomId: string, isTyping: boolean) => void
  retryMessage: (messageId: string) => Promise<void>
  toggleReaction: (messageId: string, emoji: string) => void
  createRoom: (input: CreateRoomInput) => Promise<string>
  searchUsers: (query: string) => Promise<SocialPerson[]>
  sendFriendRequest: (recipientUserId: string) => Promise<void>
  acceptFriendRequest: (requestId: string) => Promise<void>
  rejectFriendRequest: (requestId: string) => Promise<void>
  blockUser: (userId: string) => Promise<void>
  unblockUser: (userId: string) => Promise<void>
  updateContactRemark: (userId: string, remark: string | null) => Promise<void>
  updateCurrentProfile: (input: { displayName: string; username: string }) => Promise<void>
  acceptRoomInvite: (roomId: string) => Promise<void>
  rejectRoomInvite: (roomId: string) => Promise<void>
  toggleFavoriteSpace: (spaceId: string) => void
  resetDemo: () => void
  clearLocalChatData: () => Promise<void>
}

const ChatDemoContext = createContext<ChatDemoContextValue | null>(null)

function readRoomPreferences(): RoomPreferences {
  try {
    return JSON.parse(window.localStorage.getItem(UI_PREFERENCES_KEY) || '{}')
  } catch {
    window.localStorage.removeItem(UI_PREFERENCES_KEY)
    return {}
  }
}

function socialPersonToChatPerson(person: SocialPerson): ChatPerson {
  const name = person.remark || person.displayName || person.username
  return {
    id: person.id,
    matrixUserId: person.matrixUserId,
    handle: `@${person.username}`,
    displayName: name,
    initials: [...name].slice(0, 2).join('').toUpperCase(),
    color: '#356b94',
    presence: 'offline',
    bio: '',
  }
}

export function ChatDemoProvider({
  locale,
  children,
}: {
  locale: ChatLocale
  children: ReactNode
}) {
  const baseState = useMemo(() => createDemoChatState(locale), [locale])
  const [state, setState] = useState<ChatDemoState>(baseState)
  const [ready, setReady] = useState(false)
  const [mode, setMode] = useState<ChatDataMode>('fixture')
  const [syncState, setSyncState] = useState<ChatDemoContextValue['syncState']>('CONNECTING')
  const matrixClientRef = useRef<MatrixClient | null>(null)
  const runtimeRef = useRef<MatrixRuntime | null>(null)
  const runtimeModuleRef = useRef<MatrixRuntimeModule | null>(null)
  const profileRef = useRef<ReturnType<typeof sessionBootstrapSchema.parse>['user'] | null>(null)
  const preferencesRef = useRef<RoomPreferences>({})
  const pendingTransactionIdsRef = useRef(new Set<string>())
  const optimisticMessagesRef = useRef(new Map<string, ChatMessage>())
  const reconnectRetryAttemptsRef = useRef(new Map<string, number>())
  const reconnectRetryTimersRef = useRef(new Set<number>())
  const socialPeopleRef = useRef<ChatPerson[]>([])
  const socialContactIdsRef = useRef<string[]>([])
  const socialFriendRequestsRef = useRef<ChatDemoState['friendRequests']>([])
  const socialBlockedUserIdsRef = useRef<string[]>([])
  const roomMetadataRef = useRef<Record<string, RoomBootstrap>>({})
  const roomMetadataLookupRef = useRef(new Set<string>())

  const refreshMatrixState = useCallback(() => {
    const client = matrixClientRef.current
    const profile = profileRef.current
    const matrixRuntime = runtimeModuleRef.current
    if (!client || !profile || !matrixRuntime) return
    setState((current) => {
      let projected = matrixRuntime.projectMatrixChatState(
        client,
        baseState,
        profile,
        preferencesRef.current,
        pendingTransactionIdsRef.current,
        {
          people: socialPeopleRef.current,
          contactIds: socialContactIdsRef.current,
          friendRequests: socialFriendRequestsRef.current,
          blockedUserIds: socialBlockedUserIdsRef.current,
        },
        roomMetadataRef.current,
      )
      const optimisticMessages = [...optimisticMessagesRef.current.values()]
      for (const optimistic of optimisticMessages) {
        projected = {
          ...projected,
          messages: projected.messages.filter(
            (message) => message.transactionId !== optimistic.transactionId,
          ),
        }
        projected = appendMessageToState(projected, optimistic)
      }
      return projected
    })
  }, [baseState])

  const refreshRoomMetadata = useCallback(async () => {
    const client = matrixClientRef.current
    if (!client) return
    const matrixRoomIds = client.getRooms()
      .filter((room) => {
        const membership = room.getMyMembership()
        return membership === 'join' || membership === 'invite'
      })
      .map((room) => room.roomId)
      .filter((roomId) => !roomMetadataLookupRef.current.has(roomId))
    if (!matrixRoomIds.length) return
    for (const roomId of matrixRoomIds) roomMetadataLookupRef.current.add(roomId)
    try {
      const response = await fetch('/v1/rooms/metadata', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ matrixRoomIds }),
      })
      if (!response.ok) throw new Error('ROOM_METADATA_LOOKUP_FAILED')
      const metadata = roomMetadataLookupResponseSchema.parse(await response.json())
      for (const room of metadata.rooms) {
        roomMetadataRef.current[room.matrixRoomId] = room
      }
      refreshMatrixState()
    } catch (error) {
      for (const roomId of matrixRoomIds) roomMetadataLookupRef.current.delete(roomId)
      throw error
    }
  }, [refreshMatrixState])

  const refreshSocial = useCallback(async () => {
    const response = await fetch('/v1/contacts', {
      credentials: 'include',
      headers: { accept: 'application/json' },
    })
    if (!response.ok) throw new Error('SOCIAL_SNAPSHOT_FAILED')
    const snapshot = socialSnapshotSchema.parse(await response.json())
    const people = new Map<string, ChatPerson>()
    for (const person of snapshot.contacts) {
      people.set(person.id, socialPersonToChatPerson(person))
    }
    for (const request of snapshot.incomingRequests) {
      if (request.status === 'pending') {
        people.set(request.person.id, socialPersonToChatPerson(request.person))
      }
    }
    for (const person of snapshot.blockedUsers) {
      people.set(person.id, socialPersonToChatPerson(person))
    }
    socialPeopleRef.current = [...people.values()]
    socialContactIdsRef.current = snapshot.contacts.map((person) => person.id)
    socialFriendRequestsRef.current = snapshot.incomingRequests
      .filter((request) => request.status === 'pending')
      .map((request) => ({
        id: request.id,
        personId: request.person.id,
        createdAt: request.createdAt,
      }))
    socialBlockedUserIdsRef.current = snapshot.blockedUserIds
    refreshMatrixState()
  }, [refreshMatrixState])

  useEffect(() => {
    let disposed = false
    let unsubscribe: () => void = () => {}

    const hydrateFixture = () => {
      let nextState = baseState
      try {
        const raw = window.localStorage.getItem(FIXTURE_STORAGE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw) as ChatDemoState
          if (parsed.version === 1) {
            nextState = {
              ...parsed,
              blockedUserIds: parsed.blockedUserIds || [],
              typingUserIdsByRoom: parsed.typingUserIdsByRoom || {},
            }
          }
        }
      } catch {
        window.localStorage.removeItem(FIXTURE_STORAGE_KEY)
      }
      if (disposed) return
      setState(nextState)
      setMode('fixture')
      setSyncState('FIXTURE')
      setReady(true)
    }

    const start = async () => {
      try {
        const response = await fetch('/v1/session/bootstrap', {
          credentials: 'include',
          headers: { accept: 'application/json' },
        })
        if (!response.ok) {
          hydrateFixture()
          return
        }
        const parsed = sessionBootstrapSchema.safeParse(await response.json())
        if (!parsed.success) {
          hydrateFixture()
          return
        }
        if (!parsed.data.user.onboardingCompleted) {
          window.location.assign(`/${locale}/onboarding`)
          return
        }
        if (parsed.data.matrix.status !== 'ready') {
          hydrateFixture()
          return
        }

        preferencesRef.current = readRoomPreferences()
        profileRef.current = parsed.data.user
        // matrix-js-sdk is browser-only and intentionally excluded from the
        // server module graph. Loading it here keeps SSR and Vite HMR stable.
        const matrixRuntime = await import('./matrix-runtime')
        const runtime = await matrixRuntime.createMatrixRuntime(parsed.data.matrix)
        if (disposed) {
          await runtime.stop()
          return
        }
        runtimeRef.current = runtime
        runtimeModuleRef.current = matrixRuntime
        matrixClientRef.current = runtime.client
        setMode('matrix')
        await refreshSocial().catch((error) => {
          console.warn('[chat-social] Social snapshot is temporarily unavailable', {
            errorName: error instanceof Error ? error.name : 'UnknownError',
          })
        })
        const refreshProjection = () => {
          refreshMatrixState()
          void refreshRoomMetadata().catch((error) => {
            console.warn('[chat-room-metadata] Room metadata is temporarily unavailable', {
              errorName: error instanceof Error ? error.name : 'UnknownError',
            })
          })
        }
        unsubscribe = matrixRuntime.subscribeToMatrixProjection(
          runtime.client,
          refreshProjection,
          (nextSyncState) => {
            if (disposed) return
            setSyncState(nextSyncState)
            if (
              nextSyncState === matrixRuntime.SyncState.Prepared
              || nextSyncState === matrixRuntime.SyncState.Syncing
            ) {
              refreshProjection()
              setReady(true)
            }
          },
        )
      } catch (error) {
        console.warn('[chat-matrix] Falling back to fixture data', {
          errorName: error instanceof Error ? error.name : 'UnknownError',
        })
        if (!disposed) {
          setSyncState('ERROR')
          hydrateFixture()
        }
      }
    }

    setReady(false)
    setSyncState('CONNECTING')
    void start()

    return () => {
      disposed = true
      unsubscribe()
      matrixClientRef.current = null
      runtimeModuleRef.current = null
      roomMetadataRef.current = {}
      roomMetadataLookupRef.current.clear()
      optimisticMessagesRef.current.clear()
      pendingTransactionIdsRef.current.clear()
      reconnectRetryAttemptsRef.current.clear()
      for (const timerId of reconnectRetryTimersRef.current) window.clearTimeout(timerId)
      reconnectRetryTimersRef.current.clear()
      profileRef.current = null
      const runtime = runtimeRef.current
      runtimeRef.current = null
      if (runtime) void runtime.stop()
    }
  }, [baseState, refreshMatrixState, refreshRoomMetadata, refreshSocial])

  useEffect(() => {
    if (!ready || mode !== 'fixture') return
    window.localStorage.setItem(FIXTURE_STORAGE_KEY, JSON.stringify(state))
  }, [mode, ready, state])

  const updateRoomPreference = useCallback(
    (roomId: string, key: 'pinned' | 'muted') => {
      if (matrixClientRef.current) {
        const current = preferencesRef.current[roomId] || {}
        preferencesRef.current = {
          ...preferencesRef.current,
          [roomId]: { ...current, [key]: !current[key] },
        }
        window.localStorage.setItem(UI_PREFERENCES_KEY, JSON.stringify(preferencesRef.current))
        refreshMatrixState()
        return
      }
      setState((current) => ({
        ...current,
        rooms: current.rooms.map((room) =>
          room.id === roomId ? { ...room, [key]: !room[key] } : room,
        ),
      }))
    },
    [refreshMatrixState],
  )

  const markRoomRead = useCallback((roomId: string) => {
    const client = matrixClientRef.current
    if (client) {
      const event = client.getRoom(roomId)?.getLiveTimeline().getEvents().at(-1)
      if (event) void client.sendReadReceipt(event).catch(() => undefined)
    }
    setState((current) => ({
      ...current,
      rooms: current.rooms.map((room) =>
        room.id === roomId ? { ...room, unreadCount: 0 } : room,
      ),
    }))
  }, [])

  const deliverOptimisticMessage = useCallback(
    async (message: ChatMessage, allowReconnectRetry = true): Promise<string> => {
      const transactionId = message.transactionId
      const client = matrixClientRef.current
      const matrixRuntime = runtimeModuleRef.current
      if (!transactionId || !client || !matrixRuntime) throw new Error('MATRIX_NOT_READY')

      pendingTransactionIdsRef.current.add(transactionId)
      optimisticMessagesRef.current.set(transactionId, {
        ...message,
        status: 'sending',
      })
      refreshMatrixState()

      try {
        const response = await matrixRuntime.sendMatrixText(
          client,
          message.roomId,
          message.text,
          transactionId,
          message.replyToId,
        )
        pendingTransactionIdsRef.current.delete(transactionId)
        optimisticMessagesRef.current.delete(transactionId)
        reconnectRetryAttemptsRef.current.delete(transactionId)
        refreshMatrixState()
        return response.event_id
      } catch (error) {
        pendingTransactionIdsRef.current.delete(transactionId)
        const failedMessage = { ...message, status: 'failed' as const }
        optimisticMessagesRef.current.set(transactionId, failedMessage)
        refreshMatrixState()

        // The browser can report `online` before the failed request settles. In
        // that race the online event cannot see a failed item yet, so schedule
        // one idempotent retry with the original Matrix transaction id.
        if (
          allowReconnectRetry
          && navigator.onLine
        ) {
          const retryAttempt = reconnectRetryAttemptsRef.current.get(transactionId) || 0
          if (retryAttempt >= 3) throw error
          reconnectRetryAttemptsRef.current.set(transactionId, retryAttempt + 1)
          const retryDelayMs = [800, 2_000, 4_000][retryAttempt]
          const timerId = window.setTimeout(() => {
            reconnectRetryTimersRef.current.delete(timerId)
            const candidate = optimisticMessagesRef.current.get(transactionId)
            if (!candidate || candidate.status !== 'failed' || !navigator.onLine) return
            void deliverOptimisticMessage(candidate, true).catch(() => undefined)
          }, retryDelayMs)
          reconnectRetryTimersRef.current.add(timerId)
        }
        throw error
      }
    },
    [refreshMatrixState],
  )

  const sendMessage = useCallback(
    async (roomId: string, text: string, replyToId?: string) => {
      const client = matrixClientRef.current
      const matrixRuntime = runtimeModuleRef.current
      if (client && matrixRuntime) {
        const transactionId = createChatId('txn')
        pendingTransactionIdsRef.current.add(transactionId)
        const optimisticMessageId = `~${roomId}:${transactionId}`
        const optimisticMessage: ChatMessage = {
          id: optimisticMessageId,
          transactionId,
          roomId,
          senderId: state.currentUserId,
          text: text.trim(),
          createdAt: new Date().toISOString(),
          status: 'sending',
          replyToId,
          reactions: [],
        }
        optimisticMessagesRef.current.set(transactionId, optimisticMessage)
        setState((current) => appendMessageToState(current, optimisticMessage))
        return deliverOptimisticMessage(optimisticMessage)
      }

      const messageId = createChatId('message')
      const message: ChatMessage = {
        id: messageId,
        roomId,
        senderId: state.currentUserId,
        text: text.trim(),
        createdAt: new Date().toISOString(),
        status: 'sending',
        replyToId,
        reactions: [],
      }
      setState((current) => appendMessageToState(current, message))
      window.setTimeout(() => {
        setState((current) => ({
          ...current,
          messages: current.messages.map((candidate) =>
            candidate.id === messageId ? { ...candidate, status: 'sent' } : candidate,
          ),
        }))
      }, 520)
      return messageId
    },
    [deliverOptimisticMessage, state.currentUserId],
  )

  const toggleReaction = useCallback((messageId: string, emoji: string) => {
    const client = matrixClientRef.current
    const matrixRuntime = runtimeModuleRef.current
    if (client && matrixRuntime) {
      const message = state.messages.find((candidate) => candidate.id === messageId)
      if (!message) return
      void matrixRuntime.sendMatrixReaction(
        client,
        message.roomId,
        messageId,
        emoji,
        createChatId('txn'),
      ).then(refreshMatrixState, refreshMatrixState)
      return
    }

    setState((current) => ({
      ...current,
      messages: current.messages.map((message) => {
        if (message.id !== messageId) return message
        const existing = message.reactions.find((reaction) => reaction.emoji === emoji)
        if (!existing) {
          return {
            ...message,
            reactions: [...message.reactions, { emoji, userIds: [current.currentUserId] }],
          }
        }
        const hasReacted = existing.userIds.includes(current.currentUserId)
        const nextUserIds = hasReacted
          ? existing.userIds.filter((id) => id !== current.currentUserId)
          : [...existing.userIds, current.currentUserId]
        return {
          ...message,
          reactions: message.reactions
            .map((reaction) => reaction.emoji === emoji
              ? { ...reaction, userIds: nextUserIds }
              : reaction)
            .filter((reaction) => reaction.userIds.length > 0),
        }
      }),
    }))
  }, [refreshMatrixState, state.messages])

  const sendAttachment = useCallback(async (roomId: string, file: File) => {
    if (file.size > 20 * 1024 * 1024) throw new Error('ATTACHMENT_TOO_LARGE')
    const client = matrixClientRef.current
    const matrixRuntime = runtimeModuleRef.current
    if (client && matrixRuntime) {
      const response = await matrixRuntime.sendMatrixMedia(
        client,
        roomId,
        file,
        createChatId('txn'),
      )
      refreshMatrixState()
      return response.event_id
    }
    const messageId = createChatId('message')
    setState((current) => appendMessageToState(current, {
      id: messageId,
      roomId,
      senderId: current.currentUserId,
      text: '',
      createdAt: new Date().toISOString(),
      status: 'sent',
      attachment: {
        kind: file.type.startsWith('image/') ? 'image' : 'file',
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        matrixContentUri: '',
      },
      reactions: [],
    }))
    return messageId
  }, [refreshMatrixState])

  const editMessage = useCallback(async (messageId: string, text: string) => {
    const message = state.messages.find((candidate) => candidate.id === messageId)
    if (!message || message.senderId !== state.currentUserId || message.deleted) {
      throw new Error('MESSAGE_EDIT_FORBIDDEN')
    }
    const client = matrixClientRef.current
    const matrixRuntime = runtimeModuleRef.current
    if (client && matrixRuntime) {
      await matrixRuntime.editMatrixText(
        client,
        message.roomId,
        message.id,
        text.trim(),
        createChatId('txn'),
      )
      refreshMatrixState()
      return
    }
    setState((current) => ({
      ...current,
      messages: current.messages.map((candidate) => candidate.id === messageId
        ? { ...candidate, text: text.trim(), edited: true }
        : candidate),
    }))
  }, [refreshMatrixState, state.currentUserId, state.messages])

  const deleteMessage = useCallback(async (messageId: string) => {
    const message = state.messages.find((candidate) => candidate.id === messageId)
    if (!message || message.senderId !== state.currentUserId || message.deleted) {
      throw new Error('MESSAGE_DELETE_FORBIDDEN')
    }
    const client = matrixClientRef.current
    const matrixRuntime = runtimeModuleRef.current
    if (client && matrixRuntime) {
      await matrixRuntime.redactMatrixEvent(
        client,
        message.roomId,
        message.id,
        createChatId('txn'),
      )
      refreshMatrixState()
      return
    }
    setState((current) => ({
      ...current,
      messages: current.messages.map((candidate) => candidate.id === messageId
        ? {
            ...candidate,
            text: '',
            deleted: true,
            attachment: undefined,
            reactions: [],
          }
        : candidate),
    }))
  }, [refreshMatrixState, state.currentUserId, state.messages])

  const setTyping = useCallback((roomId: string, isTyping: boolean) => {
    const client = matrixClientRef.current
    const matrixRuntime = runtimeModuleRef.current
    if (client && matrixRuntime) {
      void matrixRuntime.setMatrixTyping(client, roomId, isTyping).catch(() => undefined)
    }
  }, [])

  const retryMessage = useCallback(async (messageId: string) => {
    const message = state.messages.find((candidate) => candidate.id === messageId)
    if (!message || message.status !== 'failed' || !message.transactionId) return
    reconnectRetryAttemptsRef.current.delete(message.transactionId)
    await deliverOptimisticMessage(message, true)
  }, [deliverOptimisticMessage, state.messages])

  useEffect(() => {
    const retryFailedMessages = () => {
      for (const message of optimisticMessagesRef.current.values()) {
        if (message.status === 'failed') {
          reconnectRetryAttemptsRef.current.delete(message.transactionId || message.id)
          void deliverOptimisticMessage(message, true).catch(() => undefined)
        }
      }
    }
    window.addEventListener('online', retryFailedMessages)
    return () => window.removeEventListener('online', retryFailedMessages)
  }, [deliverOptimisticMessage])

  const createRoom = useCallback(async (input: CreateRoomInput) => {
    if (matrixClientRef.current) {
      const space = state.spaces.find((candidate) => candidate.id === input.spaceId)
      const participants = input.participantIds
        .map((id) => state.people.find((person) => person.id === id))
        .filter((person): person is NonNullable<typeof person> => !!person)
      if (!space) throw new Error('ROOM_SPACE_NOT_FOUND')
      const response = await fetch('/v1/rooms', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          spaceId: input.spaceId,
          participantUserIds: input.participantIds,
          instanceConfig: {},
          clientRequestId: globalThis.crypto.randomUUID(),
          name: participants.length
            ? `${space.name} · ${participants.map((person) => person.displayName).join('、')}`
            : space.name,
        }),
      })
      if (!response.ok) throw new Error('ROOM_CREATE_FAILED')
      return roomBootstrapSchema.parse(await response.json()).matrixRoomId
    }

    const roomId = createChatId('room')
    setState((current) => createRoomInState(current, input, locale, roomId))
    return roomId
  }, [locale, state.people, state.spaces])

  const searchUsers = useCallback(async (query: string) => {
    if (matrixClientRef.current) {
      const response = await fetch(`/v1/users/search?q=${encodeURIComponent(query)}`, {
        credentials: 'include',
      })
      if (!response.ok) return []
      return userSearchResponseSchema.parse(await response.json()).users
    }
    const normalized = query.trim().toLowerCase()
    return state.people
      .filter((person) => person.id !== state.currentUserId)
      .filter((person) => `${person.displayName} ${person.handle}`.toLowerCase().includes(normalized))
      .map((person) => ({
        id: person.id,
        username: person.handle.replace(/^@/, ''),
        displayName: person.displayName,
        avatarUrl: null,
        matrixUserId: person.matrixUserId || null,
      }))
  }, [state.currentUserId, state.people])

  const sendFriendRequest = useCallback(async (recipientUserId: string) => {
    if (!matrixClientRef.current) return
    const response = await fetch('/v1/friend-requests', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ recipientUserId }),
    })
    if (!response.ok) throw new Error('FRIEND_REQUEST_FAILED')
    await refreshSocial()
  }, [refreshSocial])

  const acceptFriendRequest = useCallback(async (requestId: string) => {
    if (matrixClientRef.current) {
      const response = await fetch(`/v1/friend-requests/${encodeURIComponent(requestId)}/accept`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
      if (!response.ok) throw new Error('FRIEND_REQUEST_ACCEPT_FAILED')
      await refreshSocial()
      return
    }
    setState((current) => {
      const request = current.friendRequests.find((item) => item.id === requestId)
      if (!request) return current
      return {
        ...current,
        contactIds: Array.from(new Set([...current.contactIds, request.personId])),
        friendRequests: current.friendRequests.filter((item) => item.id !== requestId),
      }
    })
  }, [refreshSocial])

  const rejectFriendRequest = useCallback(async (requestId: string) => {
    if (matrixClientRef.current) {
      const response = await fetch(`/v1/friend-requests/${encodeURIComponent(requestId)}/reject`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
      if (!response.ok) throw new Error('FRIEND_REQUEST_REJECT_FAILED')
      await refreshSocial()
      return
    }
    setState((current) => ({
      ...current,
      friendRequests: current.friendRequests.filter((item) => item.id !== requestId),
    }))
  }, [refreshSocial])

  const updateContactRemark = useCallback(async (userId: string, remark: string | null) => {
    if (matrixClientRef.current) {
      const response = await fetch(`/v1/contacts/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ remark }),
      })
      if (!response.ok) throw new Error('CONTACT_REMARK_UPDATE_FAILED')
      await refreshSocial()
      return
    }
    const normalized = remark?.trim()
    const originalName = baseState.people.find((person) => person.id === userId)?.displayName
    setState((current) => ({
      ...current,
      people: current.people.map((person) => person.id === userId
        ? { ...person, displayName: normalized || originalName || person.displayName }
        : person),
    }))
  }, [baseState.people, refreshSocial])

  const updateCurrentProfile = useCallback(async (input: {
    displayName: string
    username: string
  }) => {
    if (matrixClientRef.current) {
      const response = await fetch('/v1/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null) as {
          error?: { code?: string }
        } | null
        throw new Error(body?.error?.code || 'PROFILE_UPDATE_FAILED')
      }
      const profile = productProfileSchema.parse(await response.json())
      if (profileRef.current) {
        profileRef.current = {
          ...profileRef.current,
          username: profile.username,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          onboardingCompleted: profile.onboardingCompleted,
        }
      }
      await matrixClientRef.current.setDisplayName(profile.displayName).catch(() => undefined)
      refreshMatrixState()
      return
    }
    setState((current) => ({
      ...current,
      people: current.people.map((person) => person.id === current.currentUserId
        ? {
            ...person,
            displayName: input.displayName.trim(),
            handle: `@${input.username.trim().toLowerCase()}`,
          }
        : person),
    }))
  }, [refreshMatrixState])

  const blockUser = useCallback(async (userId: string) => {
    if (matrixClientRef.current) {
      const response = await fetch('/v1/blocks', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (!response.ok) throw new Error('SOCIAL_BLOCK_FAILED')
      await refreshSocial()
      return
    }
    setState((current) => ({
      ...current,
      contactIds: current.contactIds.filter((id) => id !== userId),
      friendRequests: current.friendRequests.filter((request) => request.personId !== userId),
      blockedUserIds: Array.from(new Set([...current.blockedUserIds, userId])),
    }))
  }, [refreshSocial])

  const unblockUser = useCallback(async (userId: string) => {
    if (matrixClientRef.current) {
      const response = await fetch(`/v1/blocks/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!response.ok) throw new Error('SOCIAL_UNBLOCK_FAILED')
      await refreshSocial()
      return
    }
    setState((current) => ({
      ...current,
      blockedUserIds: current.blockedUserIds.filter((id) => id !== userId),
    }))
  }, [refreshSocial])

  const acceptRoomInvite = useCallback(async (roomId: string) => {
    const client = matrixClientRef.current
    if (!client) return
    await client.joinRoom(roomId)
    refreshMatrixState()
  }, [refreshMatrixState])

  const rejectRoomInvite = useCallback(async (roomId: string) => {
    const client = matrixClientRef.current
    if (!client) return
    await client.leave(roomId)
    refreshMatrixState()
  }, [refreshMatrixState])

  const toggleFavoriteSpace = useCallback((spaceId: string) => {
    setState((current) => ({
      ...current,
      favoriteSpaceIds: current.favoriteSpaceIds.includes(spaceId)
        ? current.favoriteSpaceIds.filter((id) => id !== spaceId)
        : [...current.favoriteSpaceIds, spaceId],
    }))
  }, [])

  const resetDemo = useCallback(() => {
    if (matrixClientRef.current) {
      preferencesRef.current = {}
      window.localStorage.removeItem(UI_PREFERENCES_KEY)
      refreshMatrixState()
      return
    }
    const cleanState = createDemoChatState(locale)
    setState(cleanState)
    window.localStorage.setItem(FIXTURE_STORAGE_KEY, JSON.stringify(cleanState))
  }, [locale, refreshMatrixState])

  const clearLocalChatData = useCallback(async () => {
    preferencesRef.current = {}
    window.localStorage.removeItem(UI_PREFERENCES_KEY)
    window.localStorage.removeItem(FIXTURE_STORAGE_KEY)
    const runtime = runtimeRef.current
    runtimeRef.current = null
    matrixClientRef.current = null
    if (runtime) await runtime.clear()
  }, [])

  const value = useMemo<ChatDemoContextValue>(() => ({
    state,
    ready,
    mode,
    syncState,
    markRoomRead,
    toggleRoomPinned: (roomId) => updateRoomPreference(roomId, 'pinned'),
    toggleRoomMuted: (roomId) => updateRoomPreference(roomId, 'muted'),
    sendMessage,
    sendAttachment,
    editMessage,
    deleteMessage,
    setTyping,
    retryMessage,
    toggleReaction,
    createRoom,
    searchUsers,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    blockUser,
    unblockUser,
    updateContactRemark,
    updateCurrentProfile,
    acceptRoomInvite,
    rejectRoomInvite,
    toggleFavoriteSpace,
    resetDemo,
    clearLocalChatData,
  }), [
    acceptFriendRequest,
    acceptRoomInvite,
    blockUser,
    createRoom,
    clearLocalChatData,
    markRoomRead,
    mode,
    ready,
    rejectFriendRequest,
    rejectRoomInvite,
    resetDemo,
    sendMessage,
    sendAttachment,
    editMessage,
    deleteMessage,
    setTyping,
    retryMessage,
    sendFriendRequest,
    searchUsers,
    state,
    syncState,
    toggleFavoriteSpace,
    toggleReaction,
    unblockUser,
    updateContactRemark,
    updateCurrentProfile,
    updateRoomPreference,
  ])

  return <ChatDemoContext.Provider value={value}>{children}</ChatDemoContext.Provider>
}

export function useChatDemo() {
  const value = useContext(ChatDemoContext)
  if (!value) throw new Error('useChatDemo must be used inside ChatDemoProvider')
  return value
}
