import { describe, expect, it, vi } from 'vitest'
import type { SpaceInstanceRecord } from '../../../libs/rooms/types'
import {
  createDefaultPiBinding,
  defaultPiDefinition,
} from '../../../libs/space-agents'
import {
  SpaceAgentInvocationService,
  type SpaceAgentInvocationDependencies,
} from '../../../apps/backend/src/lib/space-agent-invocation'

const now = new Date('2026-08-27T08:00:00.000Z')
const instance: SpaceInstanceRecord = {
  matrixRoomId: '!space:localhost',
  spaceInstanceId: 'space-1',
  projectId: 'project-1',
  defaultAgentId: 'pi',
  clientRequestId: 'request-1',
  spaceId: 'space-template',
  spaceVersionId: 'space-template-v1',
  creatorUserId: 'creator-1',
  participantUserIds: ['user-1'],
  instanceConfig: {},
  status: 'active',
  createdAt: now,
  updatedAt: now,
}
const request = {
  matrixEventId: '$matrix-event-1',
  message: '@pi build a scoreboard',
  agentMention: { type: 'agent' as const, id: 'pi' },
}

describe('SpaceAgentInvocationService', () => {
  it('pins binding, Definition, session, Project, policy, and reservation snapshots before enqueue', async () => {
    const dependencies = createDependencies()
    const result = await new SpaceAgentInvocationService(dependencies).invoke({
      instance,
      user: { id: 'user-1', name: 'Member One' },
      request,
    })

    expect(result).toEqual({
      accepted: true,
      deduplicated: false,
      turnId: 'turn-1',
      queuePosition: 0,
    })
    expect(dependencies.enqueueRuntime).toHaveBeenCalledWith(expect.objectContaining({
      turnId: 'turn-1',
      agentId: 'pi',
      billing: expect.objectContaining({ transactionId: 'ai-chat:space-agent-turn-1' }),
      agentTurn: expect.objectContaining({
        schemaVersion: 'vibechat.agent-turn-input/v1',
        turnId: 'turn-1',
        spaceInstanceId: 'space-1',
        agentId: 'pi',
        sessionId: 'session-1',
        sessionGeneration: 2,
        definition: expect.objectContaining({
          definitionId: defaultPiDefinition.definitionId,
          version: defaultPiDefinition.version,
          adapterKey: defaultPiDefinition.adapterKey,
          adapterVersion: defaultPiDefinition.adapterVersion,
        }),
        policy: expect.objectContaining({
          policySnapshotHash: createDefaultPiBinding('space-1', now).policySnapshotHash,
          maxCredits: 1_000,
        }),
        project: {
          projectId: 'project-1',
          revisionId: 'revision-ready-1',
          sourceHash: `sha256:${'a'.repeat(64)}`,
        },
      }),
    }))
    expect(dependencies.refundCredits).not.toHaveBeenCalled()
  })

  it('rejects a disabled binding before mention verification or charging', async () => {
    const dependencies = createDependencies({
      bindings: {
        resolveForInvocation: vi.fn().mockResolvedValue({
          status: 'denied',
          reason: 'binding_disabled',
          agentId: 'pi',
        }),
      },
    })

    await expect(invoke(dependencies)).rejects.toMatchObject({
      status: 403,
      code: 'SPACE_AGENT_NOT_ALLOWED',
    })
    expect(dependencies.verifyMention).not.toHaveBeenCalled()
    expect(dependencies.reserveCredits).not.toHaveBeenCalled()
    expect(dependencies.enqueueRuntime).not.toHaveBeenCalled()
  })

  it('keeps non-Pi Agents disabled behind the feature flag', async () => {
    const dependencies = createDependencies()
    await expect(new SpaceAgentInvocationService(dependencies).invoke({
      instance,
      user: { id: 'user-1', name: 'Member One' },
      request: { ...request, agentMention: { type: 'agent', id: 'other-agent' } },
    })).rejects.toMatchObject({ status: 403, code: 'SPACE_AGENT_NOT_ALLOWED' })
    expect(dependencies.bindings.resolveForInvocation).not.toHaveBeenCalled()
    expect(dependencies.reserveCredits).not.toHaveBeenCalled()
  })

  it('rejects a Definition outside the configured data region before charging', async () => {
    const dependencies = createDependencies({
      bindings: {
        resolveForInvocation: vi.fn().mockResolvedValue({
          status: 'resolved',
          source: 'binding',
          agentId: 'pi',
          definition: {
            ...defaultPiDefinition,
            dataRegionPolicy: { mode: 'required', regions: ['eu-west'] },
          },
          binding: createDefaultPiBinding('space-1', now),
        }),
      },
    })

    await expect(invoke(dependencies)).rejects.toMatchObject({
      status: 403,
      code: 'SPACE_AGENT_REGION_NOT_ALLOWED',
    })
    expect(dependencies.verifyMention).not.toHaveBeenCalled()
    expect(dependencies.reserveCredits).not.toHaveBeenCalled()
  })

  it('requires an exact verified Matrix mention before charging', async () => {
    const dependencies = createDependencies({
      verifyMention: vi.fn().mockResolvedValue(false),
    })
    await expect(invoke(dependencies)).rejects.toMatchObject({
      status: 400,
      code: 'SPACE_AGENT_MENTION_REQUIRED',
    })
    expect(dependencies.reserveCredits).not.toHaveBeenCalled()
    expect(dependencies.refundCredits).not.toHaveBeenCalled()
  })

  it('returns the credit balance without refunding a failed reservation', async () => {
    const dependencies = createDependencies({
      reserveCredits: vi.fn().mockResolvedValue({
        success: false,
        newBalance: 2,
        error: 'Insufficient credits',
        reservedCredits: 5,
        transactionId: 'ai-chat:space-agent-turn-1',
      }),
    })
    await expect(invoke(dependencies)).rejects.toMatchObject({
      status: 402,
      code: 'INSUFFICIENT_CREDITS',
      details: { required: 5, balance: 2 },
    })
    expect(dependencies.refundCredits).not.toHaveBeenCalled()
    expect(dependencies.enqueueRuntime).not.toHaveBeenCalled()
  })

  it('refunds once when the reservation exceeds the pinned binding budget', async () => {
    const dependencies = createDependencies({
      reserveCredits: vi.fn().mockResolvedValue(successfulReservation({ reservedCredits: 1_001 })),
    })
    await expect(invoke(dependencies)).rejects.toMatchObject({
      status: 402,
      code: 'SPACE_AGENT_BUDGET_EXCEEDED',
    })
    expect(dependencies.refundCredits).toHaveBeenCalledTimes(1)
    expect(dependencies.ensureProject).not.toHaveBeenCalled()
    expect(dependencies.enqueueRuntime).not.toHaveBeenCalled()
  })

  it('refunds a new reservation once when Runtime enqueue fails', async () => {
    const dependencies = createDependencies({
      enqueueRuntime: vi.fn().mockRejectedValue(new Error('runtime unavailable')),
    })
    await expect(invoke(dependencies)).rejects.toMatchObject({
      status: 503,
      code: 'SPACE_RUNTIME_UNAVAILABLE',
    })
    expect(dependencies.refundCredits).toHaveBeenCalledTimes(1)
  })

  it('does not issue a second refund for an idempotent reservation', async () => {
    const dependencies = createDependencies({
      reserveCredits: vi.fn().mockResolvedValue(successfulReservation({ idempotent: true })),
      enqueueRuntime: vi.fn().mockRejectedValue(new Error('runtime unavailable')),
    })
    await expect(invoke(dependencies)).rejects.toMatchObject({
      status: 503,
      code: 'SPACE_RUNTIME_UNAVAILABLE',
    })
    expect(dependencies.refundCredits).not.toHaveBeenCalled()
  })
})

function invoke(dependencies: SpaceAgentInvocationDependencies) {
  return new SpaceAgentInvocationService(dependencies).invoke({
    instance,
    user: { id: 'user-1', name: 'Member One' },
    request,
  })
}

function createDependencies(
  overrides: Partial<SpaceAgentInvocationDependencies> = {},
): SpaceAgentInvocationDependencies {
  const binding = createDefaultPiBinding('space-1', now)
  return {
    bindings: {
      resolveForInvocation: vi.fn().mockResolvedValue({
        status: 'resolved',
        source: 'binding',
        agentId: 'pi',
        definition: defaultPiDefinition,
        binding,
      }),
    },
    sessions: {
      getOrCreate: vi.fn().mockResolvedValue({
        schemaVersion: 'vibechat.agent-session-ref/v1',
        sessionId: 'session-1',
        spaceInstanceId: 'space-1',
        agentId: 'pi',
        definitionId: defaultPiDefinition.definitionId,
        definitionVersion: defaultPiDefinition.version,
        adapterKey: defaultPiDefinition.adapterKey,
        adapterVersion: defaultPiDefinition.adapterVersion,
        generation: 2,
        providerSessionRef: null,
        summaryRef: 'summary:session-1',
        summaryHash: null,
        region: 'local',
        restoreStatus: 'ready',
        lastTurnId: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      }),
    },
    verifyMention: vi.fn().mockResolvedValue(true),
    reserveCredits: vi.fn().mockResolvedValue(successfulReservation()),
    refundCredits: vi.fn().mockResolvedValue({}),
    ensureProject: vi.fn().mockResolvedValue(undefined),
    loadProject: vi.fn().mockResolvedValue({
      projectId: 'project-1',
      spaceInstanceId: 'space-1',
      sourceObjectKey: 'projects/source-1',
      sourceHash: `sha256:${'a'.repeat(64)}`,
      artifactObjectKey: null,
      artifactHash: null,
      readyRevisionId: 'revision-ready-1',
      publishedRevisionId: null,
      releaseId: null,
      metadata: {},
      fencingToken: 1,
      updatedAt: now,
    }),
    enqueueRuntime: vi.fn().mockResolvedValue({
      accepted: true,
      deduplicated: false,
      turnId: 'turn-1',
      queuePosition: 0,
    }),
    createTurnId: () => 'turn-1',
    now: () => now,
    region: 'local',
    allowMultipleAgents: false,
    ...overrides,
  } as SpaceAgentInvocationDependencies
}

function successfulReservation(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    newBalance: 95,
    transactionId: 'ai-chat:space-agent-turn-1',
    reservedCredits: 5,
    ...overrides,
  }
}
