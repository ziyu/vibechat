import { describe, expect, it } from 'vitest'
import {
  spaceAgentMemberEventContentKey,
  spaceAgentReplyEventContentKey,
} from '@vibechat/api-contracts'
import {
  matrixAgentMemberMetadata,
  matrixAgentReplyMetadata,
} from '../../../packages/matrix-client/src/agent-identity'

describe('Matrix Agent identity projection', () => {
  it('recognizes only explicitly marked Agent membership state', () => {
    expect(matrixAgentMemberMetadata({
      membership: 'join',
      displayname: 'Pi',
      [spaceAgentMemberEventContentKey]: {
        schemaVersion: 'vibechat.space-agent-member/v1',
        agentId: 'pi',
      },
    })).toEqual({
      schemaVersion: 'vibechat.space-agent-member/v1',
      agentId: 'pi',
    })
    expect(matrixAgentMemberMetadata({
      membership: 'join',
      displayname: 'Pi',
    })).toBeNull()
  })

  it('recognizes legacy virtual users from Agent reply metadata', () => {
    expect(matrixAgentReplyMetadata({
      msgtype: 'm.text',
      body: 'Hello',
      [spaceAgentReplyEventContentKey]: {
        schemaVersion: 'vibechat.space-agent-message/v1',
        agentId: 'researcher',
        turnId: 'turn-1',
        sourceEventIds: ['$source-1'],
      },
    })).toMatchObject({ agentId: 'researcher', turnId: 'turn-1' })
    expect(matrixAgentReplyMetadata({ msgtype: 'm.text', body: 'Pi' })).toBeNull()
  })
})
