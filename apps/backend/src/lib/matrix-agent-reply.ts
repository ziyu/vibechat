import {
  DatabaseIdentityRepository,
  readMatrixRuntimeConfig,
  SynapseAppserviceAdapter,
} from '@libs/identity'
import {
  spaceAgentMemberEventContentKey,
  spaceAgentMemberMetadataSchema,
  spaceAgentReplyEventContentKey,
  spaceAgentReplyMetadataSchema,
  type SpaceAgentCompletionCallback,
} from '@vibechat/api-contracts'

export interface MatrixAgentReplyResult {
  eventId: string
  matrixUserId: string
  transactionId: string
}

export async function writeMatrixAgentReply(
  input: SpaceAgentCompletionCallback,
  options: {
    fetch?: typeof globalThis.fetch
    resolveMatrixUserId?: (userId: string) => Promise<string | null>
  } = {},
): Promise<MatrixAgentReplyResult> {
  const config = readMatrixRuntimeConfig()
  if (config.status !== 'ready') throw new Error('Matrix Agent reply service is not configured')
  const fetchImpl = options.fetch || globalThis.fetch
  const identity = await new SynapseAppserviceAdapter({
    homeserverUrl: config.homeserverUrl,
    publicHomeserverUrl: config.publicHomeserverUrl,
    serverName: config.serverName,
    appserviceToken: config.appserviceToken,
    userPrefix: config.userPrefix,
    fetch: fetchImpl,
  }).ensureUser({
    externalUserId: `space-agent:${input.agentId}`,
    localpart: managedAgentLocalpart(input.agentId),
    displayName: input.agentName,
  })

  const joinUrl = new URL(
    `/_matrix/client/v3/join/${encodeURIComponent(input.matrixRoomId)}`,
    config.homeserverUrl,
  )
  const firstJoin = await matrixRequest(
    joinUrl,
    identity.matrixUserId,
    config.appserviceToken,
    {},
    'POST',
    fetchImpl,
    [403],
  )
  if (firstJoin.status === 403) {
    const inviterMatrixUserId = options.resolveMatrixUserId
      ? await options.resolveMatrixUserId(input.userId)
      : (await new DatabaseIdentityRepository().getMatrixIdentity(input.userId))?.matrixUserId || null
    if (!inviterMatrixUserId) {
      throw new Error('Matrix identity for the Agent inviter was not found')
    }
    await matrixRequest(
      new URL(
        `/_matrix/client/v3/rooms/${encodeURIComponent(input.matrixRoomId)}/state/m.room.member/${encodeURIComponent(identity.matrixUserId)}`,
        config.homeserverUrl,
      ),
      inviterMatrixUserId,
      config.appserviceToken,
      { membership: 'invite' },
      'PUT',
      fetchImpl,
    )
    await matrixRequest(
      joinUrl,
      identity.matrixUserId,
      config.appserviceToken,
      {},
      'POST',
      fetchImpl,
    )
  }

  const memberMetadata = spaceAgentMemberMetadataSchema.parse({
    schemaVersion: 'vibechat.space-agent-member/v1',
    agentId: input.agentId,
  })
  await matrixRequest(
    new URL(
      `/_matrix/client/v3/rooms/${encodeURIComponent(input.matrixRoomId)}/state/m.room.member/${encodeURIComponent(identity.matrixUserId)}`,
      config.homeserverUrl,
    ),
    identity.matrixUserId,
    config.appserviceToken,
    {
      membership: 'join',
      displayname: input.agentName,
      [spaceAgentMemberEventContentKey]: memberMetadata,
    },
    'PUT',
    fetchImpl,
  )

  const transactionId = `space-agent-${input.turnId}`
  const metadata = spaceAgentReplyMetadataSchema.parse({
    schemaVersion: 'vibechat.space-agent-message/v1',
    agentId: input.agentId,
    turnId: input.turnId,
    sourceEventIds: input.sourceEventIds,
  })
  const response = await matrixRequest(
    new URL(
      `/_matrix/client/v3/rooms/${encodeURIComponent(input.matrixRoomId)}/send/m.room.message/${encodeURIComponent(transactionId)}`,
      config.homeserverUrl,
    ),
    identity.matrixUserId,
    config.appserviceToken,
    {
      msgtype: 'm.text',
      body: input.reply.text,
      'm.relates_to': {
        'm.in_reply_to': { event_id: input.sourceEventIds[0] },
      },
      [spaceAgentReplyEventContentKey]: metadata,
    },
    'PUT',
    fetchImpl,
  )
  const body = await response.json().catch(() => null) as Record<string, unknown> | null
  if (typeof body?.event_id !== 'string') {
    throw new Error('Matrix Agent reply did not return an event ID')
  }
  return {
    eventId: body.event_id,
    matrixUserId: identity.matrixUserId,
    transactionId,
  }
}

async function matrixRequest(
  url: URL,
  matrixUserId: string,
  appserviceToken: string,
  body: Record<string, unknown>,
  method: 'POST' | 'PUT',
  fetchImpl: typeof globalThis.fetch,
  acceptedErrorStatuses: number[] = [],
) {
  url.searchParams.set('user_id', matrixUserId)
  const response = await fetchImpl(url, {
    method,
    headers: {
      authorization: `Bearer ${appserviceToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!response.ok && !acceptedErrorStatuses.includes(response.status)) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Matrix Agent reply request failed (${response.status}): ${detail.slice(0, 500)}`)
  }
  return response
}

function managedAgentLocalpart(agentId: string) {
  const readable = agentId.toLowerCase().replace(/[^a-z0-9._=-]+/g, '_').slice(0, 32) || 'agent'
  return `agent_${readable}_${stableId(agentId)}`
}

function stableId(value: string) {
  let hash = 2166136261
  for (const character of value) {
    hash ^= character.codePointAt(0) || 0
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}
