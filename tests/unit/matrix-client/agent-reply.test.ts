import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  spaceAgentMemberEventContentKey,
  spaceAgentReplyEventContentKey,
  type SpaceAgentCompletionCallback,
} from '@vibechat/api-contracts'
import { writeMatrixAgentReply } from '../../../apps/backend/src/lib/matrix-agent-reply'

const callback: SpaceAgentCompletionCallback = {
  userId: 'product-user-1',
  spaceInstanceId: 'space-instance-1',
  matrixRoomId: '!space:localhost',
  turnId: 'turn-1',
  agentId: 'pi',
  agentName: 'Pi',
  sourceEventIds: ['$human-event-1', '$human-event-2'],
  reply: { text: 'I updated the Space App.' },
}

describe('Matrix Agent reply writer', () => {
  beforeEach(() => {
    vi.stubEnv('MATRIX_HOMESERVER_URL', 'http://localhost:8008')
    vi.stubEnv('MATRIX_PUBLIC_HOMESERVER_URL', 'http://localhost:8008')
    vi.stubEnv('MATRIX_SERVER_NAME', 'localhost')
    vi.stubEnv('MATRIX_APPSERVICE_TOKEN', 'appservice-token')
    vi.stubEnv('MATRIX_TOKEN_ENCRYPTION_KEY', 'encryption-key')
    vi.stubEnv('MATRIX_USER_PREFIX', 'vibe_')
  })

  afterEach(() => vi.unstubAllEnvs())

  it('joins a managed virtual user and uses a stable Matrix transaction id', async () => {
    const sendUrls: string[] = []
    let joinAttempts = 0
    const fetchMock = vi.fn(async (urlValue: URL | RequestInfo, init?: RequestInit) => {
      const url = new URL(String(urlValue))
      if (url.pathname.endsWith('/register')) {
        const body = JSON.parse(String(init?.body)) as { username: string }
        return Response.json({ user_id: `@${body.username}:localhost` })
      }
      if (url.pathname.includes('/join/')) {
        joinAttempts += 1
        if (joinAttempts === 1) {
          return Response.json(
            { errcode: 'M_FORBIDDEN', error: 'You are not invited to this room.' },
            { status: 403 },
          )
        }
        return Response.json({ room_id: callback.matrixRoomId })
      }
      if (url.pathname.includes('/send/m.room.message/')) {
        sendUrls.push(url.href)
        return Response.json({ event_id: '$agent-event-1' })
      }
      return Response.json({})
    })

    const first = await writeMatrixAgentReply(callback, {
      fetch: fetchMock as unknown as typeof globalThis.fetch,
      resolveMatrixUserId: async () => '@vibe_member_1:localhost',
    })
    const second = await writeMatrixAgentReply(callback, {
      fetch: fetchMock as unknown as typeof globalThis.fetch,
      resolveMatrixUserId: async () => '@vibe_member_1:localhost',
    })

    expect(first).toEqual(second)
    expect(first).toMatchObject({
      eventId: '$agent-event-1',
      transactionId: 'space-agent-turn-1',
    })
    expect(sendUrls).toHaveLength(2)
    expect(sendUrls[0]).toBe(sendUrls[1])

    const inviteCall = fetchMock.mock.calls.find(([urlValue]) =>
      new URL(String(urlValue)).pathname.includes('/state/m.room.member/'))
    expect(inviteCall).toBeTruthy()
    expect(new URL(String(inviteCall![0])).searchParams.get('user_id')).toBe('@vibe_member_1:localhost')
    expect(JSON.parse(String((inviteCall![1] as RequestInit).body))).toEqual({ membership: 'invite' })

    const agentMemberCall = fetchMock.mock.calls.find(([urlValue]) => {
      const url = new URL(String(urlValue))
      return url.pathname.includes('/state/m.room.member/')
        && url.searchParams.get('user_id') === first.matrixUserId
    })
    expect(agentMemberCall).toBeTruthy()
    expect(JSON.parse(String((agentMemberCall![1] as RequestInit).body))).toEqual({
      membership: 'join',
      displayname: 'Pi',
      [spaceAgentMemberEventContentKey]: {
        schemaVersion: 'vibechat.space-agent-member/v1',
        agentId: 'pi',
      },
    })

    const sendCall = fetchMock.mock.calls.find(([urlValue]) =>
      new URL(String(urlValue)).pathname.includes('/send/m.room.message/'))
    expect(sendCall).toBeTruthy()
    const sendUrl = new URL(String(sendCall![0]))
    const sendInit = sendCall![1] as RequestInit
    const content = JSON.parse(String(sendInit.body))
    expect(sendUrl.searchParams.get('user_id')).toBe(first.matrixUserId)
    expect(content).toMatchObject({
      msgtype: 'm.text',
      body: callback.reply.text,
      'm.relates_to': {
        'm.in_reply_to': { event_id: '$human-event-1' },
      },
      [spaceAgentReplyEventContentKey]: {
        schemaVersion: 'vibechat.space-agent-message/v1',
        agentId: 'pi',
        turnId: 'turn-1',
        sourceEventIds: callback.sourceEventIds,
      },
    })
  })
})
