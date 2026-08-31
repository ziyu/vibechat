import type { SpaceAgentPublicView } from '@vibechat/space-agent-contracts'
import type { SpaceRuntimeStateCallback } from '@vibechat/api-contracts'
import type { SpaceInstanceRecord } from '@libs/rooms/types'

export function createMatrixSpaceV2Content(input: {
  instance: Pick<SpaceInstanceRecord, 'spaceInstanceId' | 'projectId'>
  state: SpaceRuntimeStateCallback
  defaultAgentId: string
  agents: SpaceAgentPublicView[]
}) {
  return {
    schemaVersion: 'vibechat.space-instance/v2' as const,
    spaceInstanceId: input.instance.spaceInstanceId,
    projectId: input.instance.projectId,
    defaultAgentId: input.defaultAgentId,
    agents: input.agents,
    readyRevisionId: input.state.readyRevisionId,
    publishedRevisionId: input.state.publishedRevisionId,
    releaseId: input.state.releaseId,
    sourceHash: input.state.sourceHash,
    sequence: input.state.sequence,
  }
}
