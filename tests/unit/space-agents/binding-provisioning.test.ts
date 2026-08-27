import { describe, expect, it, vi } from 'vitest'
import {
  createDefaultPiBinding,
  defaultPiDefinition,
} from '../../../libs/space-agents'
import { provisionDefaultSpaceAgentBinding } from '../../../apps/backend/src/lib/space-agent-binding-provisioning'

const createdAt = new Date('2026-08-27T00:00:00.000Z')

describe('default Space Agent binding provisioning', () => {
  it('creates the Pi Definition and binding for a newly created Space', async () => {
    const repository = {
      findBinding: vi.fn().mockResolvedValue(null),
      upsertDefinition: vi.fn().mockResolvedValue(undefined),
      upsertBinding: vi.fn().mockResolvedValue(undefined),
    }

    const binding = await provisionDefaultSpaceAgentBinding({
      spaceInstanceId: 'space-new',
      createdAt,
    }, repository)

    expect(repository.upsertDefinition).toHaveBeenCalledWith(defaultPiDefinition)
    expect(repository.upsertBinding).toHaveBeenCalledWith(
      createDefaultPiBinding('space-new', createdAt),
    )
    expect(binding).toEqual(createDefaultPiBinding('space-new', createdAt))
  })

  it('preserves an existing disabled binding during an idempotent room retry', async () => {
    const disabled = {
      ...createDefaultPiBinding('space-existing', createdAt),
      status: 'disabled' as const,
    }
    const repository = {
      findBinding: vi.fn().mockResolvedValue(disabled),
      upsertDefinition: vi.fn().mockResolvedValue(undefined),
      upsertBinding: vi.fn().mockResolvedValue(undefined),
    }

    await expect(provisionDefaultSpaceAgentBinding({
      spaceInstanceId: 'space-existing',
      createdAt,
    }, repository)).resolves.toEqual(disabled)
    expect(repository.upsertDefinition).not.toHaveBeenCalled()
    expect(repository.upsertBinding).not.toHaveBeenCalled()
  })
})
