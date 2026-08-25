import {
  spaceAgentMemberEventContentKey,
  spaceAgentMemberMetadataSchema,
  spaceAgentReplyEventContentKey,
  spaceAgentReplyMetadataSchema,
} from '@vibechat/api-contracts'

export function matrixAgentMemberMetadata(
  content: Record<string, unknown> | undefined,
) {
  const parsed = spaceAgentMemberMetadataSchema.safeParse(
    content?.[spaceAgentMemberEventContentKey],
  )
  return parsed.success ? parsed.data : null
}

export function matrixAgentReplyMetadata(
  content: Record<string, unknown> | undefined,
) {
  const parsed = spaceAgentReplyMetadataSchema.safeParse(
    content?.[spaceAgentReplyEventContentKey],
  )
  return parsed.success ? parsed.data : null
}
