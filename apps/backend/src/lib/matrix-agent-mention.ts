import { DatabaseIdentityRepository, readMatrixRuntimeConfig } from '@libs/identity'
import {
  spaceAgentMentionSchema,
  spaceAgentMentionsEventContentKey,
  type SpaceAgentMention,
} from '@vibechat/api-contracts'

/** Verify that the confirmed Matrix event carries the Agent target selected by the App. */
export async function verifyMatrixAgentMention(input: {
  userId: string
  matrixRoomId: string
  matrixEventId: string
  agentMention: SpaceAgentMention
}) {
  const config = readMatrixRuntimeConfig()
  if (config.status !== 'ready') return false

  const identity = await new DatabaseIdentityRepository().getMatrixIdentity(input.userId)
  if (!identity) return false

  const url = new URL(
    `/_matrix/client/v3/rooms/${encodeURIComponent(input.matrixRoomId)}/event/${encodeURIComponent(input.matrixEventId)}`,
    config.homeserverUrl,
  )
  url.searchParams.set('user_id', identity.matrixUserId)
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${config.appserviceToken}` },
  })
  if (!response.ok) return false

  const event = await response.json().catch(() => null) as Record<string, unknown> | null
  if (!event || event.type !== 'm.room.message' || event.sender !== identity.matrixUserId) return false
  const content = event.content
  if (!content || typeof content !== 'object' || Array.isArray(content)) return false
  const mentions = (content as Record<string, unknown>)[spaceAgentMentionsEventContentKey]
  if (!Array.isArray(mentions)) return false

  return mentions.some((mention) => {
    const parsed = spaceAgentMentionSchema.safeParse(mention)
    return parsed.success
      && parsed.data.type === input.agentMention.type
      && parsed.data.id === input.agentMention.id
  })
}
