import { describe, expect, it } from 'vitest'
import {
  appendMessageToState,
  filterRooms,
  sortRooms,
  type ChatMessage,
  type ChatState,
} from '@vibechat/product-core'

const baseState: ChatState = {
  version: 1,
  currentUserId: 'alice',
  people: [],
  contactIds: [],
  friendRequests: [],
  blockedUserIds: [],
  typingUserIdsByRoom: {},
  rooms: [
    { id: 'older', name: 'Older', memberIds: [], spaceId: 'space', lastMessage: '', updatedAt: '2026-01-01T00:00:00.000Z', unreadCount: 0, pinned: true, muted: false },
    { id: 'newer', name: 'Newer', memberIds: [], spaceId: 'space', lastMessage: '', updatedAt: '2026-02-01T00:00:00.000Z', unreadCount: 2, pinned: false, muted: false },
  ],
  messages: [],
  spaces: [],
  favoriteSpaceIds: [],
}

describe('product state helpers', () => {
  it('sorts pinned rooms before unread and recent rooms', () => {
    expect(sortRooms(baseState.rooms).map((room) => room.id)).toEqual(['older', 'newer'])
  })

  it('filters rooms using durable message text', () => {
    const message: ChatMessage = {
      id: 'event-1',
      roomId: 'newer',
      senderId: 'alice',
      text: 'night radio',
      createdAt: '2026-02-01T01:00:00.000Z',
      status: 'sent',
      reactions: [],
    }
    const state = { ...baseState, messages: [message] }
    expect(filterRooms(state, 'radio', false).map((room) => room.id)).toEqual(['newer'])
  })

  it('appends a message and refreshes the room summary immutably', () => {
    const message: ChatMessage = {
      id: 'event-2',
      roomId: 'older',
      senderId: 'alice',
      text: 'hello',
      createdAt: '2026-03-01T00:00:00.000Z',
      status: 'sent',
      reactions: [],
    }
    const next = appendMessageToState(baseState, message)
    expect(next).not.toBe(baseState)
    expect(next.messages).toEqual([message])
    expect(next.rooms[0]).toMatchObject({ lastMessage: 'hello', unreadCount: 0 })
  })
})
