import { DatabaseIdentityRepository, readMatrixRuntimeConfig } from '@libs/identity'
import { DatabaseRoomRepository } from '@libs/rooms'
import { spaceRuntimeStateCallbackSchema } from '@vibechat/api-contracts'

export async function writeMatrixSpaceV2State(value: unknown) {
  const state = spaceRuntimeStateCallbackSchema.parse(value)
  const instance = await new DatabaseRoomRepository().getBySpaceInstanceId(state.spaceInstanceId)
  if (!instance) throw new Error('SPACE_INSTANCE_NOT_FOUND')
  const identity = await new DatabaseIdentityRepository().getMatrixIdentity(instance.creatorUserId)
  const config = readMatrixRuntimeConfig()
  if (!identity || identity.status !== 'active' || config.status !== 'ready') {
    throw new Error('MATRIX_SPACE_STATE_UNAVAILABLE')
  }
  const url = new URL(
    `/_matrix/client/v3/rooms/${encodeURIComponent(instance.matrixRoomId)}/state/${encodeURIComponent('io.vibechat.space.instance.v2')}/`,
    config.homeserverUrl,
  )
  url.searchParams.set('user_id', identity.matrixUserId)
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${config.appserviceToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      schemaVersion: 'vibechat.space-instance/v2',
      spaceInstanceId: instance.spaceInstanceId,
      projectId: instance.projectId,
      defaultAgentId: instance.defaultAgentId,
      readyRevisionId: state.readyRevisionId,
      publishedRevisionId: state.publishedRevisionId,
      releaseId: state.releaseId,
      sourceHash: state.sourceHash,
      sequence: state.sequence,
    }),
  })
  if (!response.ok) throw new Error(`MATRIX_SPACE_STATE_FAILED_${response.status}`)
}
