'use client'

import {
  appendMessageToState,
  createChatId,
  createDemoChatState,
  createRoomInState,
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
  useState,
  type ReactNode,
} from 'react'

const STORAGE_KEY = 'vibechat-demo-state-v1'

interface ChatDemoContextValue {
  state: ChatDemoState
  ready: boolean
  markRoomRead: (roomId: string) => void
  toggleRoomPinned: (roomId: string) => void
  toggleRoomMuted: (roomId: string) => void
  sendMessage: (roomId: string, text: string, replyToId?: string) => string
  toggleReaction: (messageId: string, emoji: string) => void
  createRoom: (input: CreateRoomInput) => string
  acceptFriendRequest: (requestId: string) => void
  rejectFriendRequest: (requestId: string) => void
  toggleFavoriteSpace: (spaceId: string) => void
  resetDemo: () => void
}

const ChatDemoContext = createContext<ChatDemoContextValue | null>(null)

export function ChatDemoProvider({
  locale,
  children,
}: {
  locale: ChatLocale
  children: ReactNode
}) {
  const [state, setState] = useState<ChatDemoState>(() => createDemoChatState(locale))
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as ChatDemoState
        if (parsed.version === 1) setState(parsed)
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY)
    } finally {
      setHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [hydrated, state])

  const markRoomRead = useCallback((roomId: string) => {
    setState((current) => ({
      ...current,
      rooms: current.rooms.map((room) =>
        room.id === roomId ? { ...room, unreadCount: 0 } : room,
      ),
    }))
  }, [])

  const toggleRoomPinned = useCallback((roomId: string) => {
    setState((current) => ({
      ...current,
      rooms: current.rooms.map((room) =>
        room.id === roomId ? { ...room, pinned: !room.pinned } : room,
      ),
    }))
  }, [])

  const toggleRoomMuted = useCallback((roomId: string) => {
    setState((current) => ({
      ...current,
      rooms: current.rooms.map((room) =>
        room.id === roomId ? { ...room, muted: !room.muted } : room,
      ),
    }))
  }, [])

  const sendMessage = useCallback(
    (roomId: string, text: string, replyToId?: string) => {
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
    [state.currentUserId],
  )

  const toggleReaction = useCallback((messageId: string, emoji: string) => {
    setState((current) => ({
      ...current,
      messages: current.messages.map((message) => {
        if (message.id !== messageId) return message
        const existing = message.reactions.find((reaction) => reaction.emoji === emoji)
        if (!existing) {
          return {
            ...message,
            reactions: [
              ...message.reactions,
              { emoji, userIds: [current.currentUserId] },
            ],
          }
        }

        const hasReacted = existing.userIds.includes(current.currentUserId)
        const nextUserIds = hasReacted
          ? existing.userIds.filter((id) => id !== current.currentUserId)
          : [...existing.userIds, current.currentUserId]

        return {
          ...message,
          reactions: message.reactions
            .map((reaction) =>
              reaction.emoji === emoji
                ? { ...reaction, userIds: nextUserIds }
                : reaction,
            )
            .filter((reaction) => reaction.userIds.length > 0),
        }
      }),
    }))
  }, [])

  const createRoom = useCallback(
    (input: CreateRoomInput) => {
      const roomId = createChatId('room')
      setState((current) => {
        const nextState = createRoomInState(current, input, locale, roomId)
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
        return nextState
      })
      return roomId
    },
    [locale],
  )

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
    const cleanState = createDemoChatState(locale)
    setState(cleanState)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanState))
  }, [locale])

  const value = useMemo<ChatDemoContextValue>(
    () => ({
      state,
      ready: hydrated,
      markRoomRead,
      toggleRoomPinned,
      toggleRoomMuted,
      sendMessage,
      toggleReaction,
      createRoom,
      acceptFriendRequest,
      rejectFriendRequest,
      toggleFavoriteSpace,
      resetDemo,
    }),
    [
      acceptFriendRequest,
      createRoom,
      markRoomRead,
      rejectFriendRequest,
      resetDemo,
      sendMessage,
      state,
      toggleFavoriteSpace,
      toggleReaction,
      toggleRoomMuted,
      toggleRoomPinned,
      hydrated,
    ],
  )

  return <ChatDemoContext.Provider value={value}>{children}</ChatDemoContext.Provider>
}

export function useChatDemo() {
  const value = useContext(ChatDemoContext)
  if (!value) throw new Error('useChatDemo must be used inside ChatDemoProvider')
  return value
}
