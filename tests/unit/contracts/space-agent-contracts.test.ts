import { describe, expect, it } from 'vitest'
import {
  agentDefinitionSnapshotSchema,
  agentErrorV1Schema,
  agentSessionRefV1Schema,
  agentTurnInputV1Schema,
  agentUsageCompatSchema,
  spaceAgentBillingCallbackSchema,
  spaceAgentCompletionCallbackSchema,
} from '../../../packages/space-agent-contracts/src'
import {
  spaceAgentBillingCallbackSchema as compatibilityBillingCallbackSchema,
  spaceAgentCompletionCallbackSchema as compatibilityCompletionCallbackSchema,
} from '../../../packages/space-app-contracts/src'

const timestamp = '2026-08-27T00:00:00.000Z'
const hash = `sha256:${'a'.repeat(64)}`

function definition() {
  return {
    definitionId: 'agent-definition-pi-1',
    agentId: 'pi',
    version: '1.0.0',
    adapterKey: 'pi',
    adapterVersion: '0.2.7',
    provider: 'anthropic',
    model: 'claude-sonnet',
    capabilities: ['conversation', 'project_patch'],
    toolPolicyId: 'tool-policy-default',
    pricingPolicyId: 'pricing-policy-default',
    usageSchemaVersion: 'vibechat.agent-usage/v1' as const,
    maxBudgetCredits: 100,
    maxConcurrency: 1,
    dataRegionPolicy: { mode: 'any' as const, regions: [] },
    displayName: 'Pi',
    description: 'Default project Agent',
    status: 'active' as const,
    availability: 'available' as const,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

describe('Space Agent contracts', () => {
  it('keeps provider credentials, prompts, and provider-native payloads outside strict snapshots', () => {
    expect(agentDefinitionSnapshotSchema.safeParse({
      ...definition(),
      apiKey: 'secret',
    }).success).toBe(false)

    expect(agentSessionRefV1Schema.safeParse({
      schemaVersion: 'vibechat.agent-session-ref/v1',
      sessionId: 'session-1',
      spaceInstanceId: 'space-1',
      agentId: 'pi',
      definitionId: 'agent-definition-pi-1',
      definitionVersion: '1.0.0',
      adapterKey: 'pi',
      adapterVersion: '0.2.7',
      generation: 1,
      providerSessionRef: 'opaque-session-1',
      summaryRef: null,
      summaryHash: null,
      region: 'local',
      restoreStatus: 'ready',
      lastTurnId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      providerCredential: 'secret',
    }).success).toBe(false)

    expect(agentTurnInputV1Schema.safeParse({
      schemaVersion: 'vibechat.agent-turn-input/v1',
      turnId: 'turn-1',
      spaceInstanceId: 'space-1',
      agentId: 'pi',
      sessionId: 'session-1',
      sessionGeneration: 1,
      definition: definition(),
      policy: {
        schemaVersion: 'vibechat.agent-policy/v1',
        policySnapshotHash: hash,
        permissionPolicyId: 'permission-policy-default',
        toolPolicyId: 'tool-policy-default',
        pricingPolicyId: 'pricing-policy-default',
        maxCredits: 100,
        maxInputTokens: 16_000,
        maxOutputTokens: 4_000,
        allowedTools: [],
      },
      context: {
        matrixEventIds: ['$event-1'],
        messageWindowRef: null,
        summaryRef: null,
      },
      project: {
        projectId: 'project-1',
        revisionId: 'revision-1',
        sourceHash: hash,
      },
      requestText: 'Update the project.',
      requestedAt: timestamp,
      systemPrompt: 'hidden prompt',
      providerEvent: { type: 'native.delta' },
    }).success).toBe(false)
  })

  it('normalizes legacy usage and callbacks to their V1 wire shapes', () => {
    expect(agentUsageCompatSchema.parse({
      inputTokens: 7,
      outputTokens: 5,
      totalTokens: 12,
    })).toEqual({
      schemaVersion: 'vibechat.agent-usage/v1',
      unit: 'tokens',
      inputTokens: 7,
      outputTokens: 5,
      totalTokens: 12,
    })

    const billing = spaceAgentBillingCallbackSchema.parse({
      spaceInstanceId: 'space-1',
      turnId: 'turn-1',
      userId: 'user-1',
      requestId: 'request-1',
      provider: 'space-agent',
      model: 'pi',
      reservedCredits: 4,
      transactionId: 'transaction-1',
      status: 'completed',
      usage: { totalTokens: 12 },
    })
    expect(billing).toMatchObject({
      schemaVersion: 'vibechat.space-agent-billing/v1',
      usage: {
        schemaVersion: 'vibechat.agent-usage/v1',
        unit: 'tokens',
        totalTokens: 12,
      },
    })

    const completion = spaceAgentCompletionCallbackSchema.parse({
      userId: 'user-1',
      spaceInstanceId: 'space-1',
      matrixRoomId: '!space:localhost',
      turnId: 'turn-1',
      agentId: 'pi',
      agentName: 'Pi',
      sourceEventIds: ['$event-1'],
      reply: { text: 'Done.' },
    })
    expect(completion.schemaVersion).toBe('vibechat.space-agent-completion/v1')
  })

  it('bounds normalized diagnostics by value and total serialized size', () => {
    const base = {
      schemaVersion: 'vibechat.agent-error/v1',
      code: 'PROVIDER_UNAVAILABLE',
      retryable: true,
      sessionAction: 'retry',
      billingState: 'refund_required',
    }
    expect(agentErrorV1Schema.safeParse({
      ...base,
      diagnostics: { detail: 'x'.repeat(513) },
    }).success).toBe(false)
    expect(agentErrorV1Schema.safeParse({
      ...base,
      diagnostics: Object.fromEntries(
        Array.from({ length: 9 }, (_, index) => [`detail_${index}`, 'x'.repeat(500)]),
      ),
    }).success).toBe(false)
  })

  it('keeps legacy space-app contract exports wired to the new schemas', () => {
    expect(compatibilityBillingCallbackSchema).toBe(spaceAgentBillingCallbackSchema)
    expect(compatibilityCompletionCallbackSchema).toBe(spaceAgentCompletionCallbackSchema)
  })
})
