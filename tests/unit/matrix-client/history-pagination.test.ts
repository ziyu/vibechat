import { describe, expect, it, vi } from 'vitest'
import { loadMatrixRoomMessages } from '@vibechat/matrix-client'

vi.mock('matrix-js-sdk', () => ({
  ClientEvent: { Sync: 'sync' },
  EventTimeline: { BACKWARDS: 'b' },
  EventStatus: {
    CANCELLED: 'cancelled',
    ENCRYPTING: 'encrypting',
    NOT_SENT: 'not_sent',
    QUEUED: 'queued',
    SENDING: 'sending',
  },
  EventType: {
    Reaction: 'm.reaction',
    RoomMember: 'm.room.member',
    RoomMessage: 'm.room.message',
  },
  MsgType: { File: 'm.file', Image: 'm.image', Text: 'm.text' },
  PendingEventOrdering: { Detached: 'detached' },
  RelationType: { Annotation: 'm.annotation', Replace: 'm.replace' },
  RoomEvent: {
    LocalEchoUpdated: 'local-echo-updated',
    MyMembership: 'my-membership',
    Name: 'name',
    Timeline: 'timeline',
  },
  RoomMemberEvent: { Typing: 'typing' },
  SyncState: { Prepared: 'prepared', Syncing: 'syncing' },
  UserEvent: { AvatarUrl: 'avatar-url', DisplayName: 'display-name', Presence: 'presence' },
  IndexedDBStore: class {},
  MatrixScheduler: class {},
  createClient: vi.fn(),
}))

function messageEvent(id: string, timestamp: number, content: Record<string, unknown> = {}) {
  return {
    status: null,
    getContent: () => ({ msgtype: 'm.text', body: id, ...content }),
    getId: () => id,
    getSender: () => '@alice:localhost',
    getTs: () => timestamp,
    getTxnId: () => undefined,
    getType: () => 'm.room.message',
    isRedacted: () => false,
  }
}

function roomHarness(initialEvents: ReturnType<typeof messageEvent>[], joined = true) {
  let events = [...initialEvents]
  let paginationToken: string | null = 'history-token'
  const timeline = {
    getEvents: () => events,
    getPaginationToken: () => paginationToken,
  }
  const room = {
    roomId: '!space:localhost',
    getLiveTimeline: () => timeline,
    getMyMembership: () => joined ? 'join' : 'leave',
  }
  const scrollback = vi.fn(async () => {
    events = [messageEvent('$old-1', 1), messageEvent('$old-2', 2), ...events]
    paginationToken = null
    return room
  })
  const client = {
    getRoom: () => room,
    mxcUrlToHttp: () => null,
    scrollback,
  }
  return { client, room, scrollback }
}

describe('Matrix room history pagination', () => {
  it('scrolls backward from a known event and projects member mentions', async () => {
    const { client, scrollback } = roomHarness([
      messageEvent('$known-1', 3, {
        'm.mentions': { user_ids: ['@bob:localhost', '@bob:localhost'] },
      }),
      messageEvent('$known-2', 4),
    ])

    const page = await loadMatrixRoomMessages(
      client as never,
      '!space:localhost',
      { limit: 2, before: '$known-1' },
    )

    expect(scrollback).toHaveBeenCalledTimes(1)
    expect(page).toEqual({
      messages: [
        expect.objectContaining({ id: '$old-1' }),
        expect.objectContaining({ id: '$old-2' }),
      ],
      nextBefore: null,
      hasMore: false,
    })

    const current = await loadMatrixRoomMessages(
      client as never,
      '!space:localhost',
      { limit: 2 },
    )
    expect(current.messages[0]).toMatchObject({
      id: '$known-1',
      mentionedUserIds: ['@bob:localhost'],
    })
  })

  it('rejects invalid bounds, unknown cursors, and rooms not joined by the user', async () => {
    const joined = roomHarness([messageEvent('$known', 1)])
    await expect(loadMatrixRoomMessages(
      joined.client as never,
      '!space:localhost',
      { limit: 0 },
    )).rejects.toThrow('CHAT_HISTORY_LIMIT_INVALID')
    await expect(loadMatrixRoomMessages(
      joined.client as never,
      '!space:localhost',
      { before: '$unknown' },
    )).rejects.toThrow('CHAT_HISTORY_CURSOR_INVALID')

    const left = roomHarness([messageEvent('$known', 1)], false)
    await expect(loadMatrixRoomMessages(
      left.client as never,
      '!space:localhost',
    )).rejects.toThrow('MATRIX_ROOM_NOT_JOINED')
  })
})
