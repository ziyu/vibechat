import {
  DatabaseIdentityRepository,
  readMatrixRuntimeConfig,
  type MatrixRuntimeConfig,
} from '@libs/identity'

export async function verifyLiveMatrixMembership(
  input: { userId: string; matrixRoomId: string },
  dependencies: {
    getIdentity?: DatabaseIdentityRepository['getMatrixIdentity']
    config?: MatrixRuntimeConfig
    fetch?: typeof globalThis.fetch
  } = {},
) {
  const config = dependencies.config || readMatrixRuntimeConfig()
  if (config.status !== 'ready') return false
  const getIdentity = dependencies.getIdentity
    || new DatabaseIdentityRepository().getMatrixIdentity.bind(new DatabaseIdentityRepository())
  const identity = await getIdentity(input.userId)
  if (!identity || identity.status !== 'active') return false

  const url = new URL(
    `/_matrix/client/v3/rooms/${encodeURIComponent(input.matrixRoomId)}/state/m.room.member/${encodeURIComponent(identity.matrixUserId)}`,
    config.homeserverUrl,
  )
  url.searchParams.set('user_id', identity.matrixUserId)
  const response = await (dependencies.fetch || globalThis.fetch)(url, {
    headers: { authorization: `Bearer ${config.appserviceToken}` },
  })
  if (!response.ok) return false
  const content = await response.json().catch(() => null) as Record<string, unknown> | null
  return content?.membership === 'join'
}
