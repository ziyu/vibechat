import { describe, expect, it } from 'vitest'
import {
  parseSpaceChatHistoryOptions,
  partitionSpaceChatMentions,
} from '../../../apps/web-app/src/features/chat/space-chat-command'

describe('Space App Chat bridge validation', () => {
  it('partitions current Room members from the logical Agent target', () => {
    expect(partitionSpaceChatMentions(
      ['@bob:localhost', 'pi', '@bob:localhost'],
      ['@alice:localhost', '@bob:localhost'],
      ['pi'],
    )).toEqual({
      agentId: 'pi',
      memberIds: ['@bob:localhost'],
    })
  })

  it('fails closed for out-of-room members and multiple Agent targets', () => {
    expect(() => partitionSpaceChatMentions(
      ['@mallory:localhost'],
      ['@alice:localhost'],
      ['pi'],
    )).toThrow('CHAT_MENTION_INVALID')
    expect(() => partitionSpaceChatMentions(
      ['pi', 'researcher'],
      ['@alice:localhost'],
      ['pi', 'researcher'],
    )).toThrow('CHAT_MENTION_INVALID')
  })

  it('accepts only bounded history requests with a known App cursor', () => {
    const known = new Set(['$message-1'])
    expect(parseSpaceChatHistoryOptions({}, known)).toEqual({
      limit: 20,
      before: undefined,
    })
    expect(parseSpaceChatHistoryOptions({ limit: 50, before: '$message-1' }, known)).toEqual({
      limit: 50,
      before: '$message-1',
    })
    expect(() => parseSpaceChatHistoryOptions({ limit: 51 }, known))
      .toThrow('CHAT_HISTORY_LIMIT_INVALID')
    expect(() => parseSpaceChatHistoryOptions({ before: '$unknown' }, known))
      .toThrow('CHAT_HISTORY_CURSOR_INVALID')
  })
})
