import { describe, expect, it } from 'vitest'
import {
  applySpaceTemplateRequestSchema,
  cancelSpaceAgentTurnRequestSchema,
  spaceAgentTurnCancellationSchema,
  spaceRuntimeControlRequestSchema,
} from '../../../packages/space-app-contracts/src'

describe('Space App S4 control contracts', () => {
  it('pins Template application to an exact ready Revision and Template Version', () => {
    expect(applySpaceTemplateRequestSchema.parse({
      requestId: 'apply-template-request-1',
      expectedReadyRevisionId: '0123456789abcdef',
      spaceTemplateId: 'space-campfire',
      spaceTemplateVersionId: 'tplv-space-campfire-0-1-2',
    })).toMatchObject({
      expectedReadyRevisionId: '0123456789abcdef',
      spaceTemplateVersionId: 'tplv-space-campfire-0-1-2',
    })
    expect(applySpaceTemplateRequestSchema.safeParse({
      requestId: 'apply-template-request-1',
      expectedReadyRevisionId: '0123456789abcdef',
      spaceTemplateId: 'space-campfire',
    }).success).toBe(false)
    expect(applySpaceTemplateRequestSchema.safeParse({
      requestId: 'apply-template-request-1',
      expectedReadyRevisionId: '0123456789abcdef',
      spaceTemplateId: 'space-campfire',
      spaceTemplateVersionId: 'tplv-space-campfire-0-1-2',
      providerCredential: 'must-not-cross-the-boundary',
    }).success).toBe(false)
  })

  it('accepts strict Agent session, audit, and turn-control actions', () => {
    const lease = {
      spaceInstanceId: 'space-1',
      ownerId: 'runtime-1',
      fencingToken: 2,
      expiresAt: '2026-08-27T12:05:00.000Z',
    }
    const session = {
      schemaVersion: 'vibechat.agent-session-ref/v1',
      sessionId: 'session-1',
      spaceInstanceId: 'space-1',
      agentId: 'pi',
      definitionId: 'definition-pi',
      definitionVersion: '1.0.0',
      adapterKey: 'pi',
      adapterVersion: '1.0.0',
      generation: 1,
      providerSessionRef: null,
      summaryRef: null,
      summaryHash: null,
      region: 'local',
      restoreStatus: 'restoring',
      lastTurnId: null,
      createdAt: '2026-08-27T12:00:00.000Z',
      updatedAt: '2026-08-27T12:00:00.000Z',
    }

    expect(spaceRuntimeControlRequestSchema.parse({
      action: 'save_agent_session',
      turnId: 'turn-1',
      lease,
      session,
    })).toMatchObject({ action: 'save_agent_session', session })
    expect(spaceRuntimeControlRequestSchema.parse({
      action: 'record_agent_audit',
      turnId: 'turn-1',
      lease,
      event: {
        eventId: 'event-1',
        spaceInstanceId: 'space-1',
        agentId: 'pi',
        definitionId: 'definition-pi',
        sessionId: 'session-1',
        eventType: 'agent_event.usage',
        policySnapshotHash: `sha256:${'a'.repeat(64)}`,
        result: { totalTokens: 13 },
        createdAt: '2026-08-27T12:01:00.000Z',
      },
    })).toMatchObject({ action: 'record_agent_audit' })
    expect(spaceRuntimeControlRequestSchema.parse({
      action: 'get_agent_turn_control',
      spaceInstanceId: 'space-1',
      turnId: 'turn-1',
    })).toEqual({
      action: 'get_agent_turn_control',
      spaceInstanceId: 'space-1',
      turnId: 'turn-1',
    })
  })

  it('rejects unknown fields on S4 internal actions and public cancellation', () => {
    expect(spaceRuntimeControlRequestSchema.safeParse({
      action: 'load_agent_session',
      spaceInstanceId: 'space-1',
      agentId: 'pi',
      sessionId: 'session-1',
      generation: 1,
      providerNativeSession: 'must-not-cross-the-boundary',
    }).success).toBe(false)
    expect(cancelSpaceAgentTurnRequestSchema.safeParse({
      turnId: 'turn-1',
      anotherUserId: 'user-2',
    }).success).toBe(false)
    expect(spaceAgentTurnCancellationSchema.parse({
      accepted: true,
      turnId: 'turn-1',
      cancelRequestedAt: '2026-08-27T12:02:00.000Z',
    })).toMatchObject({ accepted: true, turnId: 'turn-1' })
  })
})
