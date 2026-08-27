import { describe, expect, it } from 'vitest'
import { createMatrixSpaceV2Content } from '../../../apps/backend/src/lib/matrix-space-v2-content'
import {
  createDefaultPiBinding,
  defaultPiDefinition,
} from '../../../libs/space-agents/bootstrap'

describe('Space Agent public snapshots', () => {
  it('adds the Product DB Agent view to Matrix v2 state while retaining defaultAgentId', () => {
    const binding = createDefaultPiBinding(
      'space-1',
      new Date('2026-08-27T00:00:00.000Z'),
    )
    const content = createMatrixSpaceV2Content({
      instance: { spaceInstanceId: 'space-1', projectId: 'project-1' },
      state: {
        spaceInstanceId: 'space-1',
        readyRevisionId: 'revision-ready-1',
        publishedRevisionId: null,
        releaseId: null,
        sourceHash: `sha256:${'a'.repeat(64)}`,
        sequence: 7,
      },
      defaultAgentId: 'pi',
      agents: [{
        binding: {
          bindingId: binding.bindingId,
          spaceInstanceId: binding.spaceInstanceId,
          agentId: binding.agentId,
          definitionId: binding.definitionId,
          definitionVersion: binding.definitionVersion,
          isDefault: binding.isDefault,
          status: binding.status,
          createdAt: binding.createdAt,
          updatedAt: binding.updatedAt,
        },
        definition: {
          definitionId: defaultPiDefinition.definitionId,
          agentId: defaultPiDefinition.agentId,
          version: defaultPiDefinition.version,
          capabilities: defaultPiDefinition.capabilities,
          displayName: defaultPiDefinition.displayName,
          description: defaultPiDefinition.description,
          status: defaultPiDefinition.status,
          availability: defaultPiDefinition.availability,
          createdAt: defaultPiDefinition.createdAt,
          updatedAt: defaultPiDefinition.updatedAt,
        },
      }],
    })

    expect(content).toMatchObject({
      schemaVersion: 'vibechat.space-instance/v2',
      defaultAgentId: 'pi',
      agents: [{
        binding: { agentId: 'pi', isDefault: true },
        definition: { displayName: 'Pi', availability: 'available' },
      }],
    })
    expect(content.agents[0]?.definition).not.toHaveProperty('provider')
    expect(content.agents[0]?.binding).not.toHaveProperty('budgetPolicy')
  })
})
