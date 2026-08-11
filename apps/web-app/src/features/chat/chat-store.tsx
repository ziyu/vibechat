'use client'

import {
  appendMessageToState,
  createChatId,
  createDemoChatState,
  createRoomInState,
  roomBootstrapSchema,
  sessionBootstrapSchema,
  type ChatDemoState,
  type ChatLocale,
  type ChatMessage,
  type CreateRoomInput,
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
import {
  MsgType,
  RelationType,
  type MatrixClient,
} from 'matrix-js-sdk'
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events'
import {
  createMatrixRuntime,
  EventType,
  projectMatrixChatState,
  subscribeToMatrixProjection,
  SyncState,
  type MatrixRuntime,
} from './matrix-runtime'

const FIXTURE_STORAGE_KEY = 'vibechat-demo-state-v1'
const UI_PREFERENCES_KEY = 'vibechat-chat-ui-v1'

type ChatDataMode = 'fixture' | 'matrix'
type RoomPreferences = Record<string, { pinned?: boolean; muted?: boolean }>

interface ChatDemoContextValue {
  state: ChatDemoState
  ready: boolean
  mode: ChatDataMode
  syncState: SyncState | 'FIXTURE' | 'CONNECTING' | 'ERROR'
  markRoomRead: (roomId: string) => void
  toggleRoomPinned: (roomId: string) => void
  toggleRoomMuted: (roomId: string) => void
  sendMessage: (roomId: string, text: string, replyToId?: string) => Promise<string>
  toggleReaction: (messageId: string, emoji: string) => void
  createRoom: (input: CreateRoomInput) => Promise<string>
  acceptFriendRequest: (requestId: string) => void
  rejectFriendRequest: (requestId: string) => void
  toggleFavoriteSpace: (spaceId: string) => void
  resetDemo: () => void
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
  const profileRef = useRef<ReturnType<typeof sessionBootstrapSchema.parse>['user'] | null>(null)
  const preferencesRef = useRef<RoomPreferences>({})
  const pendingTransactionIdsRef = useRef(new Set<string>())

  const refreshMatrixState = useCallback(() => {
    const client = matrixClientRef.current
    const profile = profileRef.current
    if (!client || !profile) return
    setState((current) => {
      let projected = projectMatrixChatState(
        client,
        baseState,
        profile,
        preferencesRef.current,
        pendingTransactionIdsRef.current,
      )
      const optimisticMessages = current.messages.filter(
        (message) => message.transactionId
          && pendingTransactionIdsRef.current.has(message.transactionId),
      )
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

  useEffect(() => {
    let disposed = false
    let unsubscribe: () => void = () => {}

    const hydrateFixture = () => {
      let nextState = baseState
      try {
        const raw = window.localStorage.getItem(FIXTURE_STORAGE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw) as ChatDemoState
          if (parsed.version === 1) nextState = parsed
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
        if (!parsed.success || parsed.data.matrix.status !== 'ready') {
          hydrateFixture()
          return
        }

        preferencesRef.current = readRoomPreferences()
        profileRef.current = parsed.data.user
        const runtime = await createMatrixRuntime(parsed.data.matrix)
        if (disposed) {
          await runtime.stop()
          return
        }
        runtimeRef.current = runtime
        matrixClientRef.current = runtime.client
        setMode('matrix')
        unsubscribe = subscribeToMatrixProjection(
          runtime.client,
          refreshMatrixState,
          (nextSyncState) => {
            if (disposed) return
            setSyncState(nextSyncState)
            if (nextSyncState === SyncState.Prepared || nextSyncState === SyncState.Syncing) {
              refreshMatrixState()
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
      profileRef.current = null
      const runtime = runtimeRef.current
      runtimeRef.current = null
      if (runtime) void runtime.stop()
    }
  }, [baseState, refreshMatrixState])

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

  const sendMessage = useCallback(
    async (roomId: string, text: string, replyToId?: string) => {
      const client = matrixClientRef.current
      if (client) {
        const transactionId = createChatId('txn')
        pendingTransactionIdsRef.current.add(transactionId)
        const optimisticMessageId = `~${roomId}:${transactionId}`
        const content = (replyToId ? {
          msgtype: MsgType.Text,
          body: text.trim(),
          'm.relates_to': {
            'm.in_reply_to': { event_id: replyToId },
          },
        } : {
          msgtype: MsgType.Text,
          body: text.trim(),
        }) as RoomMessageEventContent
        setState((current) => appendMessageToState(current, {
          id: optimisticMessageId,
          transactionId,
          roomId,
          senderId: current.currentUserId,
          text: text.trim(),
          createdAt: new Date().toISOString(),
          status: 'sending',
          replyToId,
          reactions: [],
        }))
        const pending = client.sendEvent(
          roomId,
          EventType.RoomMessage,
          content,
          transactionId,
        )
        try {
          const response = await pending
          pendingTransactionIdsRef.current.delete(transactionId)
          refreshMatrixState()
          return response.event_id
        } catch (error) {
          pendingTransactionIdsRef.current.delete(transactionId)
          setState((current) => ({
            ...current,
            messages: current.messages.map((message) =>
              message.id === optimisticMessageId ? { ...message, status: 'failed' } : message,
            ),
          }))
          throw error
        }
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
    [refreshMatrixState, state.currentUserId],
  )

  const toggleReaction = useCallback((messageId: string, emoji: string) => {
    const client = matrixClientRef.current
    if (client) {
      const message = state.messages.find((candidate) => candidate.id === messageId)
      if (!message) return
      void client.sendEvent(message.roomId, EventType.Reaction, {
        'm.relates_to': {
          rel_type: RelationType.Annotation,
          event_id: messageId,
          key: emoji,
        },
      }, createChatId('txn')).then(refreshMatrixState, refreshMatrixState)
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

  const acceptFriendRequest = useCallback((requestId: string) => {
    setState((current) => {
      const request = current.friendRequests.find((item) => item.id === requestId)
      if (!request) return current
      return {
        ...current,
        contactIds: Array.from(new Set([...current.contactIds, request.personId])),
        friendRequests: current.friendRequests.filter((item) => item.id !== requestId),
      }
    })
  }, [])

  const rejectFriendRequest = useCallback((requestId: string) => {
    setState((current) => ({
      ...current,
      friendRequests: current.friendRequests.filter((item) => item.id !== requestId),
    }))
  }, [])

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

  const value = useMemo<ChatDemoContextValue>(() => ({
    state,
    ready,
    mode,
    syncState,
    markRoomRead,
    toggleRoomPinned: (roomId) => updateRoomPreference(roomId, 'pinned'),
    toggleRoomMuted: (roomId) => updateRoomPreference(roomId, 'muted'),
    sendMessage,
    toggleReaction,
    createRoom,
    acceptFriendRequest,
    rejectFriendRequest,
    toggleFavoriteSpace,
    resetDemo,
  }), [
    acceptFriendRequest,
    createRoom,
    markRoomRead,
    mode,
    ready,
    rejectFriendRequest,
    resetDemo,
    sendMessage,
    state,
    syncState,
    toggleFavoriteSpace,
    toggleReaction,
    updateRoomPreference,
  ])

  return <ChatDemoContext.Provider value={value}>{children}</ChatDemoContext.Provider>
}

export function useChatDemo() {
  const value = useContext(ChatDemoContext)
  if (!value) throw new Error('useChatDemo must be used inside ChatDemoProvider')
  return value
}
