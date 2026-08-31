import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events'
import {
  spaceAgentMentionsEventContentKey,
  type SpaceAgentMention,
} from '@vibechat/api-contracts'

export function createMatrixTextContent(
  text: string,
  replyToId?: string,
  agentMentions: SpaceAgentMention[] = [],
  memberMentionIds: string[] = [],
) {
  const content = (replyToId ? {
    msgtype: 'm.text',
    body: text,
    'm.relates_to': {
      'm.in_reply_to': { event_id: replyToId },
    },
  } : {
    msgtype: 'm.text',
    body: text,
  }) as RoomMessageEventContent & Record<string, unknown>
  if (agentMentions.length > 0) {
    content[spaceAgentMentionsEventContentKey] = agentMentions
  }
  const mentionedUserIds = [...new Set(memberMentionIds)]
    .filter((userId) => userId.startsWith('@') && userId.includes(':'))
    .slice(0, 50)
  if (mentionedUserIds.length > 0) {
    content['m.mentions'] = { user_ids: mentionedUserIds }
  }
  return content
}
