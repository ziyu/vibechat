export interface SpaceChatMentionPartition {
  agentId?: string
  memberIds: string[]
}

export function partitionSpaceChatMentions(
  value: unknown,
  memberIds: readonly string[],
  availableAgentIds: readonly string[],
): SpaceChatMentionPartition {
  if (!Array.isArray(value)) return { memberIds: [] }
  const mentionIds = value.filter(
    (item): item is string => typeof item === 'string' && item.length > 0 && item.length <= 255,
  )
  if (mentionIds.length !== value.length || mentionIds.length > 50) {
    throw new Error('CHAT_MENTION_INVALID')
  }

  const uniqueMentionIds = [...new Set(mentionIds)]
  const roomMembers = new Set(memberIds)
  const agents = new Set(availableAgentIds)
  if (uniqueMentionIds.some((id) => !roomMembers.has(id) && !agents.has(id))) {
    throw new Error('CHAT_MENTION_INVALID')
  }

  const mentionedAgentIds = uniqueMentionIds.filter((id) => agents.has(id))
  if (mentionedAgentIds.length > 1) throw new Error('CHAT_MENTION_INVALID')
  return {
    ...(mentionedAgentIds[0] ? { agentId: mentionedAgentIds[0] } : {}),
    memberIds: uniqueMentionIds.filter((id) => roomMembers.has(id)),
  }
}

export function parseSpaceChatHistoryOptions(
  payload: Record<string, unknown>,
  knownMessageIds: ReadonlySet<string>,
) {
  const limit = payload.limit === undefined || payload.limit === null ? 20 : payload.limit
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new Error('CHAT_HISTORY_LIMIT_INVALID')
  }
  const before = payload.before === undefined || payload.before === null
    ? undefined
    : requiredMessageId(payload.before)
  if (before && !knownMessageIds.has(before)) throw new Error('CHAT_HISTORY_CURSOR_INVALID')
  return { limit, before }
}

function requiredMessageId(value: unknown) {
  if (typeof value !== 'string' || !value || value.length > 255) {
    throw new Error('CHAT_MESSAGE_ID_INVALID')
  }
  return value
}
