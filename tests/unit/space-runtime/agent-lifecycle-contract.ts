import type {
  AgentDefinitionSnapshot,
  AgentEventV1,
  AgentSessionRefV1,
} from '../../../packages/space-agent-contracts/src'
import {
  agentEventV1Schema,
  agentSessionRefV1Schema,
  agentSessionRestoreResultV1Schema,
  agentSessionSummaryV1Schema,
  cancelAgentTurnInputV1Schema,
} from '../../../packages/space-agent-contracts/src'
import type {
  SpaceAgentLifecycleAdapter,
  RunAgentTurnInput,
} from '../../../apps/space-runtime/src/adapters/contract'
import {
  createAgentProjectWorkspace,
} from '../../../apps/space-runtime/src/adapters/project-workspace'
import { describe, expect, it } from 'vitest'

const timestamp = '2026-08-27T00:00:00.000Z'
const hash = `sha256:${'a'.repeat(64)}`

export interface AgentLifecycleContractFactoryOptions {
  restoreMode?: 'restored' | 'rebuild_required'
}

export type AgentLifecycleContractFactory = (
  options?: AgentLifecycleContractFactoryOptions,
) => SpaceAgentLifecycleAdapter

export interface AgentLifecycleContractIdentity {
  adapterKey: string
  adapterVersion: string
}

const fakeIdentity: AgentLifecycleContractIdentity = {
  adapterKey: 'fake',
  adapterVersion: '1.0.0',
}

export function createAgentDefinitionFixture(
  agentId = 'fake',
  identity: AgentLifecycleContractIdentity = fakeIdentity,
): AgentDefinitionSnapshot {
  return {
    definitionId: `definition-${agentId}`,
    agentId,
    version: '1.0.0',
    adapterKey: identity.adapterKey,
    adapterVersion: identity.adapterVersion,
    provider: identity.adapterKey,
    model: 'deterministic',
    capabilities: ['conversation', 'project_patch'],
    toolPolicyId: 'tool-policy-default',
    pricingPolicyId: 'pricing-policy-default',
    usageSchemaVersion: 'vibechat.agent-usage/v1',
    maxBudgetCredits: 100,
    maxConcurrency: 1,
    dataRegionPolicy: { mode: 'any', regions: [] },
    displayName: `Fake ${agentId}`,
    description: 'Deterministic contract-test Agent',
    status: 'active',
    availability: 'available',
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function createAgentSessionFixture(options: {
  spaceInstanceId?: string
  agentId?: string
  sessionId?: string
  generation?: number
  restoreStatus?: AgentSessionRefV1['restoreStatus']
  identity?: AgentLifecycleContractIdentity
} = {}): AgentSessionRefV1 {
  const agentId = options.agentId || 'fake'
  const identity = options.identity || fakeIdentity
  return {
    schemaVersion: 'vibechat.agent-session-ref/v1',
    sessionId: options.sessionId || `session-${agentId}`,
    spaceInstanceId: options.spaceInstanceId || 'space-1',
    agentId,
    definitionId: `definition-${agentId}`,
    definitionVersion: '1.0.0',
    adapterKey: identity.adapterKey,
    adapterVersion: identity.adapterVersion,
    generation: options.generation || 1,
    providerSessionRef: null,
    summaryRef: null,
    summaryHash: null,
    region: 'local',
    restoreStatus: options.restoreStatus || 'restoring',
    lastTurnId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function createAgentTurnInputFixture(options: {
  turnId?: string
  spaceInstanceId?: string
  agentId?: string
  sessionId?: string
  sessionGeneration?: number
  requestText?: string
  identity?: AgentLifecycleContractIdentity
} = {}): RunAgentTurnInput {
  const agentId = options.agentId || 'fake'
  const identity = options.identity || fakeIdentity
  return {
    schemaVersion: 'vibechat.agent-turn-input/v1',
    turnId: options.turnId || 'turn-1',
    spaceInstanceId: options.spaceInstanceId || 'space-1',
    agentId,
    sessionId: options.sessionId || `session-${agentId}`,
    sessionGeneration: options.sessionGeneration || 1,
    definition: createAgentDefinitionFixture(agentId, identity),
    policy: {
      schemaVersion: 'vibechat.agent-policy/v1',
      policySnapshotHash: hash,
      permissionPolicyId: 'permission-policy-default',
      toolPolicyId: 'tool-policy-default',
      pricingPolicyId: 'pricing-policy-default',
      maxCredits: 100,
      maxInputTokens: 16_000,
      maxOutputTokens: 4_000,
      allowedTools: ['project.patch'],
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
    requestText: options.requestText || 'Answer this message.',
    requestedAt: timestamp,
    projectWorkspace: createAgentProjectWorkspace('revision-1', {
      'package.json': '{}',
      'tsconfig.json': '{}',
      'src/index.ts': 'export default {}',
    }),
  }
}

export async function collectAgentEvents(
  events: AsyncIterable<AgentEventV1>,
) {
  const collected: AgentEventV1[] = []
  for await (const event of events) collected.push(event)
  return collected
}

async function collectIterator(
  iterator: AsyncIterator<AgentEventV1>,
) {
  const collected: AgentEventV1[] = []
  while (true) {
    const next = await iterator.next()
    if (next.done) return collected
    collected.push(next.value)
  }
}

function expectValidEventStream(events: AgentEventV1[]) {
  expect(events.length).toBeGreaterThan(0)
  for (const event of events) {
    expect(agentEventV1Schema.safeParse(event).success).toBe(true)
  }
  expect(events.map((event) => event.sequence)).toEqual(
    events.map((_, index) => index),
  )
  expect(new Set(events.map((event) => event.eventId)).size).toBe(events.length)
  const terminalEvents = events.filter(
    (event) => event.type === 'completed' || event.type === 'failed',
  )
  expect(terminalEvents).toHaveLength(1)
  expect(events.at(-1)).toBe(terminalEvents[0])
}

export function runAgentLifecycleContractSuite(
  label: string,
  createAdapter: AgentLifecycleContractFactory,
  identity: AgentLifecycleContractIdentity = fakeIdentity,
) {
  describe(`${label} lifecycle contract`, () => {
    it('begins isolated, strict, provider-neutral sessions', async () => {
      const adapter = createAdapter()
      const signal = new AbortController().signal
      const sessionA = createAgentSessionFixture({
        spaceInstanceId: 'space-a',
        agentId: 'fake-a',
        sessionId: 'session-shared',
        identity,
      })
      const sessionB = createAgentSessionFixture({
        spaceInstanceId: 'space-b',
        agentId: 'fake-b',
        sessionId: 'session-shared',
        identity,
      })

      const [startedA, startedB] = await Promise.all([
        adapter.beginSession({
          definition: createAgentDefinitionFixture('fake-a', identity),
          session: sessionA,
          requestedAt: timestamp,
        }, signal),
        adapter.beginSession({
          definition: createAgentDefinitionFixture('fake-b', identity),
          session: sessionB,
          requestedAt: timestamp,
        }, signal),
      ])

      expect(agentSessionRefV1Schema.safeParse(startedA).success).toBe(true)
      expect(agentSessionRefV1Schema.safeParse(startedB).success).toBe(true)
      expect(startedA.restoreStatus).toBe('ready')
      expect(startedB.restoreStatus).toBe('ready')
      expect(startedA.providerSessionRef).not.toBe(startedB.providerSessionRef)
      expect(agentSessionRefV1Schema.safeParse({
        ...startedA,
        providerCredential: 'secret',
      }).success).toBe(false)
    })

    it('streams strict monotonic chat, revision, usage, and one terminal event', async () => {
      const adapter = createAdapter()
      const chatEvents = await collectAgentEvents(adapter.runTurn(
        createAgentTurnInputFixture({ turnId: 'turn-chat', identity }),
        new AbortController().signal,
      ))
      const revisionEvents = await collectAgentEvents(adapter.runTurn(
        createAgentTurnInputFixture({
          turnId: 'turn-revision',
          requestText: '[fake:revision] add a note',
          identity,
        }),
        new AbortController().signal,
      ))

      expectValidEventStream(chatEvents)
      expectValidEventStream(revisionEvents)
      expect(chatEvents.some((event) => event.type === 'text_delta')).toBe(true)
      expect(chatEvents.some((event) => event.type === 'usage')).toBe(true)
      expect(chatEvents.at(-1)).toMatchObject({
        type: 'completed',
        outcome: 'conversation',
        usage: { schemaVersion: 'vibechat.agent-usage/v1', totalTokens: 13 },
      })
      expect(revisionEvents.some((event) => event.type === 'tool_activity')).toBe(true)
      expect(revisionEvents.some((event) => event.type === 'project_patch')).toBe(true)
      expect(revisionEvents.at(-1)).toMatchObject({
        type: 'completed',
        outcome: 'revision',
        projectRevisionId: expect.any(String),
      })
      expect(agentEventV1Schema.safeParse({
        ...chatEvents[0],
        providerNativeEvent: { type: 'fake.delta' },
      }).success).toBe(false)
    })

    it('handles idempotent cancel and AbortSignal without crossing isolation keys', async () => {
      const adapter = createAdapter()
      const activeInput = createAgentTurnInputFixture({
        turnId: 'turn-cancel',
        spaceInstanceId: 'space-a',
        agentId: 'fake-a',
        sessionId: 'session-shared',
        identity,
      })
      const iterator = adapter.runTurn(
        activeInput,
        new AbortController().signal,
      )[Symbol.asyncIterator]()
      const first = await iterator.next()
      expect(first.value).toMatchObject({ type: 'status', sequence: 0 })
      const cancelInput = cancelAgentTurnInputV1Schema.parse({
        schemaVersion: 'vibechat.agent-turn-cancel/v1',
        turnId: activeInput.turnId,
        spaceInstanceId: activeInput.spaceInstanceId,
        agentId: activeInput.agentId,
        sessionId: activeInput.sessionId,
        sessionGeneration: activeInput.sessionGeneration,
        reason: 'user_requested',
        requestedAt: timestamp,
      })
      await adapter.cancel(cancelInput, new AbortController().signal)
      await adapter.cancel(cancelInput, new AbortController().signal)
      const cancelledEvents = [
        first.value as AgentEventV1,
        ...await collectIterator(iterator),
      ]

      expectValidEventStream(cancelledEvents)
      expect(cancelledEvents.at(-1)).toMatchObject({
        type: 'failed',
        error: { code: 'AGENT_TURN_CANCELLED' },
      })

      const isolatedEvents = await collectAgentEvents(adapter.runTurn(
        createAgentTurnInputFixture({
          turnId: 'turn-cancel',
          spaceInstanceId: 'space-b',
          agentId: 'fake-b',
          sessionId: 'session-shared',
          identity,
        }),
        new AbortController().signal,
      ))
      expectValidEventStream(isolatedEvents)
      expect(isolatedEvents.at(-1)).toMatchObject({ type: 'completed' })

      const abortController = new AbortController()
      const abortIterator = adapter.runTurn(
        createAgentTurnInputFixture({ turnId: 'turn-abort', identity }),
        abortController.signal,
      )[Symbol.asyncIterator]()
      const abortFirst = await abortIterator.next()
      abortController.abort()
      const abortedEvents = [
        abortFirst.value as AgentEventV1,
        ...await collectIterator(abortIterator),
      ]
      expectValidEventStream(abortedEvents)
      expect(abortedEvents.at(-1)).toMatchObject({
        type: 'failed',
        error: { code: 'AGENT_TURN_CANCELLED' },
      })
    })

    it('summarizes sessions without sharing refs across Space or Agent', async () => {
      const adapter = createAdapter()
      const signal = new AbortController().signal
      const sessionA = createAgentSessionFixture({
        spaceInstanceId: 'space-a',
        agentId: 'fake-a',
        sessionId: 'session-shared',
        identity,
      })
      const sessionB = createAgentSessionFixture({
        spaceInstanceId: 'space-b',
        agentId: 'fake-b',
        sessionId: 'session-shared',
        identity,
      })
      const [summaryA, summaryB] = await Promise.all([
        adapter.summarize({
          session: sessionA,
          sourceTurnId: 'turn-summary',
          maxSummaryCharacters: 1_000,
          requestedAt: timestamp,
        }, signal),
        adapter.summarize({
          session: sessionB,
          sourceTurnId: 'turn-summary',
          maxSummaryCharacters: 1_000,
          requestedAt: timestamp,
        }, signal),
      ])

      expect(agentSessionSummaryV1Schema.safeParse(summaryA).success).toBe(true)
      expect(agentSessionSummaryV1Schema.safeParse(summaryB).success).toBe(true)
      expect(summaryA.summaryRef).not.toBe(summaryB.summaryRef)
      expect(summaryA.summaryHash).not.toBe(summaryB.summaryHash)
    })

    it('returns explicit restored and rebuild-required session results', async () => {
      const session = createAgentSessionFixture({ identity })
      const input = {
        definition: createAgentDefinitionFixture('fake', identity),
        session,
        requestedAt: timestamp,
      }
      const restored = await createAdapter({ restoreMode: 'restored' }).restore(
        input,
        new AbortController().signal,
      )
      const rebuild = await createAdapter({
        restoreMode: 'rebuild_required',
      }).restore(input, new AbortController().signal)

      expect(agentSessionRestoreResultV1Schema.safeParse(restored).success).toBe(true)
      expect(agentSessionRestoreResultV1Schema.safeParse(rebuild).success).toBe(true)
      expect(restored).toMatchObject({
        status: 'restored',
        session: { restoreStatus: 'ready' },
      })
      expect(rebuild).toMatchObject({
        status: 'rebuild_required',
        session: {
          restoreStatus: 'rebuild_required',
          providerSessionRef: null,
        },
      })
    })
  })
}
