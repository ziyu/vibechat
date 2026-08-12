'use client'

import {
  atmosphereSpaceDirectorySchema,
  appendMessageToState,
  createChatId,
  productProfileSchema,
  productPreferencesSchema,
  productStateSnapshotSchema,
  roomBootstrapSchema,
  roomMetadataLookupResponseSchema,
  sessionBootstrapSchema,
  socialSnapshotSchema,
  userSearchResponseSchema,
  type ChatState,
  type ChatLocale,
  type ChatMessage,
  type ChatPerson,
  type CreateRoomInput,
  type ProductStateSnapshotResponse,
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

type RoomPreferences = Record<string, { pinned?: boolean; muted?: boolean }>
type MatrixRuntimeModule = typeof import('./matrix-runtime')
type ProductPreferences = ProductStateSnapshotResponse['preferences']
type ConnectionState = SyncState | 'CONNECTING' | 'UNAVAILABLE' | 'ERROR'
const legacyChatStorageKeys = ['vibechat-demo-state-v1', 'vibechat-chat-ui-v1']

interface ChatContextValue {
  state: ChatState
  ready: boolean
  connectionState: ConnectionState
  productPreferences: ProductPreferences
  retryConnection: () => void
  markRoomRead: (roomId: string) => void
  toggleRoomPinned: (roomId: string) => Promise<void>
  toggleRoomMuted: (roomId: string) => Promise<void>
  sendMessage: (roomId: string, text: string, replyToId?: string) => Promise<string>
  sendAttachment: (roomId: string, file: File) => Promise<string>
  editMessage: (messageId: string, text: string) => Promise<void>
  deleteMessage: (messageId: string) => Promise<void>
  setTyping: (roomId: string, isTyping: boolean) => void
  retryMessage: (messageId: string) => Promise<void>
  toggleReaction: (messageId: string, emoji: string) => Promise<void>
  createRoom: (input: CreateRoomInput) => Promise<string>
  searchUsers: (query: string) => Promise<SocialPerson[]>
  sendFriendRequest: (recipientUserId: string) => Promise<void>
  acceptFriendRequest: (requestId: string) => Promise<void>
  rejectFriendRequest: (requestId: string) => Promise<void>
  blockUser: (userId: string) => Promise<void>
  unblockUser: (userId: string) => Promise<void>
  updateContactRemark: (userId: string, remark: string | null) => Promise<void>
  updateCurrentProfile: (input: {
    displayName: string
    username: string
    avatarUrl?: string | null
  }) => Promise<void>
  acceptRoomInvite: (roomId: string) => Promise<void>
  rejectRoomInvite: (roomId: string) => Promise<void>
  toggleFavoriteSpace: (spaceId: string) => Promise<void>
  updateProductPreferences: (patch: Partial<ProductPreferences>) => Promise<void>
  clearLocalChatData: () => Promise<void>
}

const defaultProductPreferences: ProductPreferences = {
  notificationsEnabled: true,
  theme: 'system',
  locale: 'en',
}

const ChatContext = createContext<ChatContextValue | null>(null)

function socialPersonToChatPerson(person: SocialPerson): ChatPerson {
  const name = person.remark || person.displayName || person.username
  return {
    id: person.id,
    matrixUserId: person.matrixUserId,
    avatarUrl: person.avatarUrl,
    handle: `@${person.username}`,
    displayName: name,
    initials: [...name].slice(0, 2).join('').toUpperCase(),
    color: '#356b94',
    presence: 'offline',
    bio: '',
  }
}

function profileToChatPerson(profile: ReturnType<typeof sessionBootstrapSchema.parse>['user']): ChatPerson {
  return {
    id: profile.id,
    matrixUserId: null,
    avatarUrl: profile.avatarUrl,
    handle: `@${profile.username}`,
    displayName: profile.displayName,
    initials: [...(profile.displayName || profile.username)].slice(0, 2).join('').toUpperCase(),
    color: '#e4472f',
    presence: 'online',
    bio: '',
  }
}

function createEmptyProductState(): ChatState {
  return {
    version: 1,
    currentUserId: '',
    people: [],
    contactIds: [],
    friendRequests: [],
    blockedUserIds: [],
    typingUserIdsByRoom: {},
    rooms: [],
    messages: [],
    spaces: [],
    favoriteSpaceIds: [],
  }
}

export function ChatProvider({
  locale,
  children,
}: {
  locale: ChatLocale
  children: ReactNode
}) {
  const initialState = useMemo(() => createEmptyProductState(), [locale])
  const [state, setState] = useState<ChatState>(initialState)
  const [ready, setReady] = useState(false)
  const [connectionState, setConnectionState] = useState<ConnectionState>('CONNECTING')
  const [productPreferences, setProductPreferences] = useState(defaultProductPreferences)
  const [connectionAttempt, setConnectionAttempt] = useState(0)
  const baseStateRef = useRef<ChatState>(initialState)
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
  const socialFriendRequestsRef = useRef<ChatState['friendRequests']>([])
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
        baseStateRef.current,
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
  }, [])

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

    const start = async () => {
      try {
        for (const key of legacyChatStorageKeys) window.localStorage.removeItem(key)
        const response = await fetch('/v1/session/bootstrap', {
          credentials: 'include',
          headers: { accept: 'application/json' },
        })
        if (!response.ok) {
          if (response.status === 401) {
            window.location.assign(`/${locale}/signin`)
            return
          }
          throw new Error('SESSION_BOOTSTRAP_FAILED')
        }
        const parsed = sessionBootstrapSchema.safeParse(await response.json())
        if (!parsed.success) throw new Error('SESSION_BOOTSTRAP_INVALID')
        if (!parsed.data.user.onboardingCompleted) {
          window.location.assign(`/${locale}/onboarding`)
          return
        }
        if (parsed.data.matrix.status !== 'ready') {
          profileRef.current = parsed.data.user
          const nextState = createEmptyProductState()
          nextState.currentUserId = parsed.data.user.id
          nextState.people = [profileToChatPerson(parsed.data.user)]
          baseStateRef.current = nextState
          if (!disposed) {
            setState(nextState)
            setConnectionState('UNAVAILABLE')
            setReady(false)
          }
          return
        }

        const [productStateResponse, spacesResponse, socialResponse] = await Promise.all([
          fetch('/v1/product-state', { credentials: 'include', headers: { accept: 'application/json' } }),
          fetch(`/v1/spaces?locale=${encodeURIComponent(locale)}`, {
            credentials: 'include',
            headers: { accept: 'application/json' },
          }),
          fetch('/v1/contacts', { credentials: 'include', headers: { accept: 'application/json' } }),
        ])
        if (!productStateResponse.ok || !spacesResponse.ok || !socialResponse.ok) {
          throw new Error('PRODUCT_STATE_LOAD_FAILED')
        }
        const productState = productStateSnapshotSchema.parse(await productStateResponse.json())
        const directory = atmosphereSpaceDirectorySchema.parse(await spacesResponse.json())
        const snapshot = socialSnapshotSchema.parse(await socialResponse.json())
        if (productState.preferences.locale !== locale) {
          const localeResponse = await fetch('/v1/product-state', {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ locale }),
          })
          if (!localeResponse.ok) throw new Error('PRODUCT_LOCALE_SYNC_FAILED')
          productState.preferences = productPreferencesSchema.parse(await localeResponse.json())
        }
        preferencesRef.current = Object.fromEntries(productState.roomPreferences.map((preference) => [
          preference.matrixRoomId,
          { pinned: preference.pinned, muted: preference.muted },
        ]))
        setProductPreferences(productState.preferences)
        const nextBaseState = createEmptyProductState()
        nextBaseState.currentUserId = parsed.data.user.id
        nextBaseState.people = [profileToChatPerson(parsed.data.user)]
        nextBaseState.spaces = directory.spaces.map((space) => ({
          id: space.id,
          name: space.name,
          author: space.author,
          summary: space.summary,
          category: space.category,
          icon: space.icon,
          accent: space.accent,
          canvas: space.canvas,
          permissions: space.permissions,
          networkDomains: space.networkDomains,
          official: space.official,
          favoriteCount: space.favoriteCount,
        }))
        nextBaseState.favoriteSpaceIds = productState.favoriteSpaceIds
        baseStateRef.current = nextBaseState
        setState(nextBaseState)
        profileRef.current = parsed.data.user
        const people = new Map<string, ChatPerson>()
        for (const person of snapshot.contacts) people.set(person.id, socialPersonToChatPerson(person))
        for (const request of snapshot.incomingRequests) {
          if (request.status === 'pending') people.set(request.person.id, socialPersonToChatPerson(request.person))
        }
        for (const person of snapshot.blockedUsers) people.set(person.id, socialPersonToChatPerson(person))
        socialPeopleRef.current = [...people.values()]
        socialContactIdsRef.current = snapshot.contacts.map((person) => person.id)
        socialFriendRequestsRef.current = snapshot.incomingRequests
          .filter((request) => request.status === 'pending')
          .map((request) => ({ id: request.id, personId: request.person.id, createdAt: request.createdAt }))
        socialBlockedUserIdsRef.current = snapshot.blockedUserIds
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
            setConnectionState(nextSyncState)
            if (
              nextSyncState === matrixRuntime.SyncState.Prepared
              || nextSyncState === matrixRuntime.SyncState.Syncing
            ) {
              refreshProjection()
              setReady(true)
            } else if (nextSyncState === matrixRuntime.SyncState.Error) {
              setReady(false)
            }
          },
        )
        const currentSyncState = runtime.client.getSyncState()
        if (
          currentSyncState === matrixRuntime.SyncState.Prepared
          || currentSyncState === matrixRuntime.SyncState.Syncing
        ) {
          setConnectionState(currentSyncState)
          refreshProjection()
          setReady(true)
        }
      } catch (error) {
        console.error('[chat] Product state bootstrap failed', {
          errorName: error instanceof Error ? error.name : 'UnknownError',
        })
        if (!disposed) {
          setConnectionState('ERROR')
          setReady(false)
        }
      }
    }

    setReady(false)
    setConnectionState('CONNECTING')
    setState(initialState)
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
  }, [connectionAttempt, initialState, locale, refreshMatrixState, refreshRoomMetadata])

  const retryConnection = useCallback(() => setConnectionAttempt((attempt) => attempt + 1), [])

  const updateRoomPreference = useCallback(
    async (roomId: string, key: 'pinned' | 'muted') => {
      if (!matrixClientRef.current) throw new Error('MATRIX_NOT_READY')
      const current = preferencesRef.current[roomId] || {}
      const next = {
        pinned: current.pinned || false,
        muted: current.muted || false,
        [key]: !current[key],
      }
      const response = await fetch(`/v1/rooms/${encodeURIComponent(roomId)}/preferences`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(next),
      })
      if (!response.ok) throw new Error('ROOM_PREFERENCE_UPDATE_FAILED')
      preferencesRef.current = { ...preferencesRef.current, [roomId]: next }
      refreshMatrixState()
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
      if (!client || !matrixRuntime) throw new Error('MATRIX_NOT_READY')
      const transactionId = createChatId('txn')
      pendingTransactionIdsRef.current.add(transactionId)
      const optimisticMessage: ChatMessage = {
        id: `~${roomId}:${transactionId}`,
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
    },
    [deliverOptimisticMessage, state.currentUserId],
  )

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    const client = matrixClientRef.current
    const matrixRuntime = runtimeModuleRef.current
    if (!client || !matrixRuntime) throw new Error('MATRIX_NOT_READY')
    const message = state.messages.find((candidate) => candidate.id === messageId)
    if (!message) throw new Error('MESSAGE_NOT_FOUND')
    await matrixRuntime.toggleMatrixReaction(
      client,
      message.roomId,
      messageId,
      emoji,
      createChatId('txn'),
    )
    refreshMatrixState()
  }, [refreshMatrixState, state.messages])

  const sendAttachment = useCallback(async (roomId: string, file: File) => {
    const sizeLimit = file.type.startsWith('image/') ? 20 : 100
    if (file.size > sizeLimit * 1024 * 1024) throw new Error('ATTACHMENT_TOO_LARGE')
    const client = matrixClientRef.current
    const matrixRuntime = runtimeModuleRef.current
    if (!client || !matrixRuntime) throw new Error('MATRIX_NOT_READY')
    const response = await matrixRuntime.sendMatrixMedia(
      client,
      roomId,
      file,
      createChatId('txn'),
    )
    refreshMatrixState()
    return response.event_id
  }, [refreshMatrixState])

  const editMessage = useCallback(async (messageId: string, text: string) => {
    const message = state.messages.find((candidate) => candidate.id === messageId)
    if (!message || message.senderId !== state.currentUserId || message.deleted) {
      throw new Error('MESSAGE_EDIT_FORBIDDEN')
    }
    const client = matrixClientRef.current
    const matrixRuntime = runtimeModuleRef.current
    if (!client || !matrixRuntime) throw new Error('MATRIX_NOT_READY')
    await matrixRuntime.editMatrixText(client, message.roomId, message.id, text.trim(), createChatId('txn'))
    refreshMatrixState()
  }, [refreshMatrixState, state.currentUserId, state.messages])

  const deleteMessage = useCallback(async (messageId: string) => {
    const message = state.messages.find((candidate) => candidate.id === messageId)
    if (!message || message.senderId !== state.currentUserId || message.deleted) {
      throw new Error('MESSAGE_DELETE_FORBIDDEN')
    }
    const client = matrixClientRef.current
    const matrixRuntime = runtimeModuleRef.current
    if (!client || !matrixRuntime) throw new Error('MATRIX_NOT_READY')
    await matrixRuntime.redactMatrixEvent(client, message.roomId, message.id, createChatId('txn'))
    refreshMatrixState()
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
    if (!matrixClientRef.current) throw new Error('MATRIX_NOT_READY')
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
  }, [locale, state.people, state.spaces])

  const searchUsers = useCallback(async (query: string) => {
    const response = await fetch(`/v1/users/search?q=${encodeURIComponent(query)}`, {
      credentials: 'include',
    })
    if (!response.ok) throw new Error('USER_SEARCH_FAILED')
    return userSearchResponseSchema.parse(await response.json()).users
  }, [])

  const sendFriendRequest = useCallback(async (recipientUserId: string) => {
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
    const response = await fetch(`/v1/friend-requests/${encodeURIComponent(requestId)}/accept`, {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: '{}',
    })
    if (!response.ok) throw new Error('FRIEND_REQUEST_ACCEPT_FAILED')
    await refreshSocial()
  }, [refreshSocial])

  const rejectFriendRequest = useCallback(async (requestId: string) => {
    const response = await fetch(`/v1/friend-requests/${encodeURIComponent(requestId)}/reject`, {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: '{}',
    })
    if (!response.ok) throw new Error('FRIEND_REQUEST_REJECT_FAILED')
    await refreshSocial()
  }, [refreshSocial])

  const updateContactRemark = useCallback(async (userId: string, remark: string | null) => {
    const response = await fetch(`/v1/contacts/${encodeURIComponent(userId)}`, {
      method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ remark }),
    })
    if (!response.ok) throw new Error('CONTACT_REMARK_UPDATE_FAILED')
    await refreshSocial()
  }, [refreshSocial])

  const updateCurrentProfile = useCallback(async (input: {
    displayName: string
    username: string
    avatarUrl?: string | null
  }) => {
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
    await matrixClientRef.current?.setDisplayName(profile.displayName).catch(() => undefined)
    refreshMatrixState()
  }, [refreshMatrixState])

  const blockUser = useCallback(async (userId: string) => {
    const response = await fetch('/v1/blocks', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
    if (!response.ok) throw new Error('SOCIAL_BLOCK_FAILED')
    await refreshSocial()
  }, [refreshSocial])

  const unblockUser = useCallback(async (userId: string) => {
    const response = await fetch(`/v1/blocks/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
    if (!response.ok) throw new Error('SOCIAL_UNBLOCK_FAILED')
    await refreshSocial()
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

  const toggleFavoriteSpace = useCallback(async (spaceId: string) => {
    const favorite = !state.favoriteSpaceIds.includes(spaceId)
    const response = await fetch(`/v1/spaces/${encodeURIComponent(spaceId)}/favorite`, {
      method: 'PUT', credentials: 'include', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ favorite }),
    })
    if (!response.ok) throw new Error('SPACE_FAVORITE_UPDATE_FAILED')
    const wasFavorite = baseStateRef.current.favoriteSpaceIds.includes(spaceId)
    const favoriteDelta = favorite === wasFavorite ? 0 : favorite ? 1 : -1
    baseStateRef.current = {
      ...baseStateRef.current,
      favoriteSpaceIds: favorite
        ? [...new Set([...baseStateRef.current.favoriteSpaceIds, spaceId])]
        : baseStateRef.current.favoriteSpaceIds.filter((id) => id !== spaceId),
      spaces: baseStateRef.current.spaces.map((space) => space.id === spaceId
        ? { ...space, favoriteCount: Math.max(0, space.favoriteCount + favoriteDelta) }
        : space),
    }
    refreshMatrixState()
  }, [refreshMatrixState, state.favoriteSpaceIds])

  const updateProductPreferences = useCallback(async (patch: Partial<ProductPreferences>) => {
    const response = await fetch('/v1/product-state', {
      method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!response.ok) throw new Error('PRODUCT_PREFERENCES_UPDATE_FAILED')
    setProductPreferences(productPreferencesSchema.parse(await response.json()))
  }, [])

  const clearLocalChatData = useCallback(async () => {
    preferencesRef.current = {}
    for (const key of legacyChatStorageKeys) window.localStorage.removeItem(key)
    const runtime = runtimeRef.current
    runtimeRef.current = null
    matrixClientRef.current = null
    if (runtime) await runtime.clear()
  }, [])

  const value = useMemo<ChatContextValue>(() => ({
    state,
    ready,
    connectionState,
    productPreferences,
    retryConnection,
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
    updateProductPreferences,
    clearLocalChatData,
  }), [
    acceptFriendRequest,
    acceptRoomInvite,
    blockUser,
    createRoom,
    clearLocalChatData,
    markRoomRead,
    connectionState,
    productPreferences,
    ready,
    rejectFriendRequest,
    rejectRoomInvite,
    retryConnection,
    sendMessage,
    sendAttachment,
    editMessage,
    deleteMessage,
    setTyping,
    retryMessage,
    sendFriendRequest,
    searchUsers,
    state,
    toggleFavoriteSpace,
    toggleReaction,
    unblockUser,
    updateContactRemark,
    updateCurrentProfile,
    updateProductPreferences,
    updateRoomPreference,
  ])

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChat() {
  const value = useContext(ChatContext)
  if (!value) throw new Error('useChat must be used inside ChatProvider')
  return value
}
