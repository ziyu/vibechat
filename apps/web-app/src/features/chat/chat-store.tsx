'use client'

import {
  sessionBootstrapSchema,
  type ProductStateSnapshotResponse,
  type RoomBootstrap,
  type SocialPerson,
} from '@vibechat/api-contracts'
import {
  appendMessageToState,
  createChatId,
  type ChatState,
  type ChatLocale,
  type ChatMessage,
  type ChatPerson,
  type CreateRoomInput,
} from '@vibechat/product-core'
import { ProductApiClient, ProductApiClientError } from '@vibechat/product-client'
import { browserProductPlatform } from '@/lib/product-platform'
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
import type { MatrixClient, MatrixRuntime, SyncState } from '@vibechat/matrix-client'

type RoomPreferences = Record<string, { pinned?: boolean; muted?: boolean }>
type MatrixRuntimeModule = typeof import('@vibechat/matrix-client')
type ProductPreferences = ProductStateSnapshotResponse['preferences']
type ConnectionState = SyncState | 'CONNECTING' | 'UNAVAILABLE' | 'ERROR'
const legacyChatStorageKeys = ['vibechat-demo-state-v1', 'vibechat-chat-ui-v1']
const productApi = new ProductApiClient()

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
  requestSpaceAgent: (roomId: string, matrixEventId: string, text: string) => Promise<boolean>
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
      const metadata = await productApi.lookupRoomMetadata(matrixRoomIds)
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
    const snapshot = await productApi.getSocialSnapshot()
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
        for (const key of legacyChatStorageKeys) browserProductPlatform.storage.remove(key)
        const bootstrap = await productApi.bootstrapSession()
        if (!bootstrap.user.onboardingCompleted) {
          browserProductPlatform.navigation.openOnboarding(locale)
          return
        }
        if (bootstrap.matrix.status !== 'ready') {
          profileRef.current = bootstrap.user
          const nextState = createEmptyProductState()
          nextState.currentUserId = bootstrap.user.id
          nextState.people = [profileToChatPerson(bootstrap.user)]
          baseStateRef.current = nextState
          if (!disposed) {
            setState(nextState)
            setConnectionState('UNAVAILABLE')
            setReady(false)
          }
          return
        }

        const [productState, directory, snapshot] = await Promise.all([
          productApi.getProductState(),
          productApi.getSpaces(locale),
          productApi.getSocialSnapshot(),
        ])
        if (productState.preferences.locale !== locale) {
          productState.preferences = await productApi.updateProductPreferences({ locale })
        }
        preferencesRef.current = Object.fromEntries(productState.roomPreferences.map((preference) => [
          preference.matrixRoomId,
          { pinned: preference.pinned, muted: preference.muted },
        ]))
        setProductPreferences(productState.preferences)
        const nextBaseState = createEmptyProductState()
        nextBaseState.currentUserId = bootstrap.user.id
        nextBaseState.people = [profileToChatPerson(bootstrap.user)]
        nextBaseState.spaces = directory.spaces.map((space) => ({
          schemaVersion: space.schemaVersion,
          id: space.id,
          versionId: space.versionId,
          semanticVersion: space.semanticVersion,
          integrity: space.integrity,
          sourceHash: space.sourceHash,
          manifestHash: space.manifestHash,
          artifact: space.artifact,
          projectFormat: space.projectFormat,
          compatibility: space.compatibility,
          provenance: space.provenance,
          publisher: space.publisher,
          name: space.name,
          author: space.author,
          summary: space.summary,
          category: space.category,
          icon: space.icon,
          accent: space.accent,
          canvas: space.canvas,
          permissions: space.permissions,
          networkDomains: space.networkDomains,
          favoriteCount: space.favoriteCount,
        }))
        nextBaseState.favoriteSpaceIds = productState.favoriteSpaceIds
        baseStateRef.current = nextBaseState
        setState(nextBaseState)
        profileRef.current = bootstrap.user
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
        const matrixRuntime = await import('@vibechat/matrix-client')
        const runtime = await matrixRuntime.createMatrixRuntime(bootstrap.matrix, {
          indexedDB: browserProductPlatform.indexedDB,
        })
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
          (nextSyncState, syncData) => {
            if (disposed) return
            setConnectionState(nextSyncState)
            if (
              nextSyncState === matrixRuntime.SyncState.Prepared
              || nextSyncState === matrixRuntime.SyncState.Syncing
            ) {
              refreshProjection()
              setReady(true)
            } else if (nextSyncState === matrixRuntime.SyncState.Error) {
              const syncError = syncData?.error as Error & {
                httpStatus?: number
                errcode?: string
              } | undefined
              console.error('[chat-matrix] Sync failed', {
                errorName: syncError?.name || 'UnknownError',
                httpStatus: syncError?.httpStatus || null,
                matrixErrorCode: syncError?.errcode || null,
                message: syncError?.message || null,
              })
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
        if (error instanceof ProductApiClientError && error.status === 401) {
          browserProductPlatform.navigation.openSignIn(locale)
          return
        }
        console.error(
          '[chat] Product state bootstrap failed',
          error instanceof Error ? error.name : 'UnknownError',
          error instanceof Error ? error.message : 'Unknown failure',
        )
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
      for (const timerId of reconnectRetryTimersRef.current) browserProductPlatform.clearTimeout(timerId)
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
      await productApi.updateRoomPreference(roomId, next)
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
          && browserProductPlatform.isOnline()
        ) {
          const retryAttempt = reconnectRetryAttemptsRef.current.get(transactionId) || 0
          if (retryAttempt >= 3) throw error
          reconnectRetryAttemptsRef.current.set(transactionId, retryAttempt + 1)
          const retryDelayMs = [800, 2_000, 4_000][retryAttempt]
          const timerId = browserProductPlatform.setTimeout(() => {
            reconnectRetryTimersRef.current.delete(timerId)
            const candidate = optimisticMessagesRef.current.get(transactionId)
            if (!candidate || candidate.status !== 'failed' || !browserProductPlatform.isOnline()) return
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

  const requestSpaceAgent = useCallback(async (
    roomId: string,
    matrixEventId: string,
    text: string,
  ) => {
    const agentId = roomMetadataRef.current[roomId]?.defaultAgentId || 'pi'
    const mention = new RegExp(`(^|\\s)@${agentId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s|$)`, 'i')
    if (!mention.test(text)) return false
    await productApi.createSpaceAgentTurn(roomId, { matrixEventId, message: text, agentId })
    return true
  }, [])

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
    return browserProductPlatform.onOnline(retryFailedMessages)
  }, [deliverOptimisticMessage])

  const createRoom = useCallback(async (input: CreateRoomInput) => {
    if (!matrixClientRef.current) throw new Error('MATRIX_NOT_READY')
    const space = state.spaces.find((candidate) => candidate.id === input.spaceId)
    const participants = input.participantIds
      .map((id) => state.people.find((person) => person.id === id))
      .filter((person): person is NonNullable<typeof person> => !!person)
    if (!space) throw new Error('ROOM_SPACE_NOT_FOUND')
    const room = await productApi.createRoom({
      spaceId: input.spaceId,
      participantUserIds: input.participantIds,
      instanceConfig: {},
      clientRequestId: globalThis.crypto.randomUUID(),
      name: participants.length
        ? `${space.name} · ${participants.map((person) => person.displayName).join('、')}`
        : space.name,
    })
    return room.matrixRoomId
  }, [locale, state.people, state.spaces])

  const searchUsers = useCallback(async (query: string) => {
    return productApi.searchUsers(query)
  }, [])

  const sendFriendRequest = useCallback(async (recipientUserId: string) => {
    await productApi.sendFriendRequest(recipientUserId)
    await refreshSocial()
  }, [refreshSocial])

  const acceptFriendRequest = useCallback(async (requestId: string) => {
    await productApi.acceptFriendRequest(requestId)
    await refreshSocial()
  }, [refreshSocial])

  const rejectFriendRequest = useCallback(async (requestId: string) => {
    await productApi.rejectFriendRequest(requestId)
    await refreshSocial()
  }, [refreshSocial])

  const updateContactRemark = useCallback(async (userId: string, remark: string | null) => {
    await productApi.updateContactRemark(userId, remark)
    await refreshSocial()
  }, [refreshSocial])

  const updateCurrentProfile = useCallback(async (input: {
    displayName: string
    username: string
    avatarUrl?: string | null
  }) => {
    const profile = await productApi.updateProfile(input)
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
    await productApi.blockUser(userId)
    await refreshSocial()
  }, [refreshSocial])

  const unblockUser = useCallback(async (userId: string) => {
    await productApi.unblockUser(userId)
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
    await productApi.setFavoriteSpace(spaceId, favorite)
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
    setProductPreferences(await productApi.updateProductPreferences(patch))
  }, [])

  const clearLocalChatData = useCallback(async () => {
    preferencesRef.current = {}
    for (const key of legacyChatStorageKeys) browserProductPlatform.storage.remove(key)
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
    requestSpaceAgent,
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
    requestSpaceAgent,
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
