import {
  spaceRuntimeLeaseSchema,
  type SpaceRuntimeLease,
} from '@vibechat/space-app-contracts'
import {
  agentSessionRefV1Schema,
  type AgentSessionRefV1,
} from '@vibechat/space-agent-contracts'
import {
  signSpaceRuntimeCredential,
  spaceBackendCallbackAudience,
} from '@vibechat/space-runtime-auth'
import type { SpaceTurnRequest } from './space-instance-server.js'
import { runtimeReplicaOwnerId } from './runtime-replica.js'

const controlPath = '/v1/internal/space-runtime-control'
const leaseTtlMs = 30_000

export interface DurableSpaceInstanceSnapshot {
  sequence: number
  snapshot: Record<string, unknown>
}

export interface DurableAgentAuditEvent {
  eventId: string
  spaceInstanceId: string
  agentId: string
  definitionId: string | null
  sessionId: string | null
  eventType: string
  policySnapshotHash: string | null
  result: Record<string, unknown>
  createdAt: string
}

export interface DurableAgentTurnControl {
  status: 'queued' | 'active' | 'completed' | 'failed'
  cancelRequestedAt: string | null
}

export interface DurableSpaceControl {
  readonly description: string
  loadInstance(spaceInstanceId: string): Promise<DurableSpaceInstanceSnapshot | null>
  saveInstance(
    spaceInstanceId: string,
    sequence: number,
    snapshot: Record<string, unknown>,
  ): Promise<void>
  enqueueTurn(
    spaceInstanceId: string,
    request: SpaceTurnRequest,
  ): Promise<{ turnId: string; deduplicated: boolean }>
  claimTurn(spaceInstanceId: string): Promise<SpaceTurnRequest | null>
  completeTurn(
    spaceInstanceId: string,
    turnId: string,
    status: 'completed' | 'failed',
  ): Promise<boolean>
  loadAgentSession(input: {
    spaceInstanceId: string
    agentId: string
    sessionId: string
    generation: number
  }): Promise<AgentSessionRefV1 | null>
  saveAgentSession(turnId: string, session: AgentSessionRefV1): Promise<void>
  rebuildAgentSession(input: {
    turnId: string
    session: AgentSessionRefV1
  }): Promise<AgentSessionRefV1>
  recordAgentAudit(turnId: string, event: DurableAgentAuditEvent): Promise<void>
  getAgentTurnControl(
    spaceInstanceId: string,
    turnId: string,
  ): Promise<DurableAgentTurnControl>
  heartbeat(spaceInstanceId: string): Promise<void>
  listRunnableSpaceInstanceIds(): Promise<string[]>
  reconcileOutbox(): Promise<void>
}

export function createDurableSpaceControlFromEnv(): DurableSpaceControl {
  const origin = process.env.SPACE_RUNTIME_CALLBACK_ORIGIN?.trim()
  const signingSecret = process.env.SPACE_RUNTIME_INTERNAL_TOKEN?.trim()
  if (!origin || !signingSecret) {
    throw new Error(
      'Space Runtime requires SPACE_RUNTIME_CALLBACK_ORIGIN and SPACE_RUNTIME_INTERNAL_TOKEN',
    )
  }
  return new BackendDurableSpaceControl(origin, signingSecret)
}

export class BackendDurableSpaceControl implements DurableSpaceControl {
  readonly description = 'product-db'
  readonly #origin: string
  readonly #signingSecret: string
  readonly #leases = new Map<string, SpaceRuntimeLease>()

  constructor(origin: string, signingSecret: string) {
    this.#origin = new URL(origin).origin
    this.#signingSecret = signingSecret
  }

  async loadInstance(spaceInstanceId: string) {
    const response = await this.#control({ action: 'load_instance', spaceInstanceId })
    if (!response.ok) throw new Error(`Space Instance state read returned ${response.status}`)
    const body = await response.json() as { instance?: unknown }
    if (!body.instance) return null
    const instance = body.instance as Record<string, unknown>
    if (
      typeof instance.sequence !== 'number'
      || !instance.snapshot
      || typeof instance.snapshot !== 'object'
    ) throw new Error('Space Instance state read returned an invalid snapshot')
    return {
      sequence: instance.sequence,
      snapshot: instance.snapshot as Record<string, unknown>,
    }
  }

  async saveInstance(
    spaceInstanceId: string,
    sequence: number,
    snapshot: Record<string, unknown>,
  ) {
    const lease = await this.#lease(spaceInstanceId)
    const response = await this.#control({
      action: 'save_instance',
      lease,
      instance: { spaceInstanceId, sequence, snapshot },
    })
    if (response.status === 409) {
      this.#leases.delete(spaceInstanceId)
      throw new Error(`Space Runtime owner was fenced for ${spaceInstanceId}`)
    }
    if (!response.ok) throw new Error(`Space Instance state write returned ${response.status}`)
  }

  async enqueueTurn(spaceInstanceId: string, request: SpaceTurnRequest) {
    const response = await this.#control({
      action: 'enqueue_turn',
      turn: {
        turnId: request.turnId,
        spaceInstanceId,
        externalRequestId: request.externalRequestId,
        kind: request.kind,
        ...(request.agentTurn ? {
          agentId: request.agentTurn.agentId,
          agentDefinitionId: request.agentTurn.definition.definitionId,
          agentDefinitionVersion: request.agentTurn.definition.version,
          adapterKey: request.agentTurn.definition.adapterKey,
          adapterVersion: request.agentTurn.definition.adapterVersion,
          sessionGeneration: request.agentTurn.sessionGeneration,
          policySnapshotHash: request.agentTurn.policy.policySnapshotHash,
          payloadSchemaVersion: request.agentTurn.schemaVersion,
        } : {}),
        ...(request.billing ? {
          reservationTransactionId: request.billing.transactionId,
        } : {}),
        payload: request,
      },
    })
    if (!response.ok) throw new Error(`Space Turn enqueue returned ${response.status}`)
    const body = await response.json() as { turn?: unknown }
    const turn = body.turn as Record<string, unknown> | undefined
    if (!turn || typeof turn.turnId !== 'string') {
      throw new Error('Space Turn enqueue returned an invalid record')
    }
    return {
      turnId: turn.turnId,
      deduplicated: turn.turnId !== request.turnId,
    }
  }

  async claimTurn(spaceInstanceId: string) {
    const response = await this.#control({
      action: 'claim_turn',
      spaceInstanceId,
      ownerId: runtimeReplicaOwnerId,
      ttlMs: leaseTtlMs,
    })
    if (!response.ok) throw new Error(`Space Turn claim returned ${response.status}`)
    const body = await response.json() as { lease?: unknown; turn?: unknown }
    if (!body.lease) return null
    const lease = spaceRuntimeLeaseSchema.parse(body.lease)
    this.#leases.set(spaceInstanceId, lease)
    if (!body.turn) return null
    const turn = body.turn as Record<string, unknown>
    if (!turn.payload || typeof turn.payload !== 'object') {
      throw new Error('Space Turn claim returned an invalid payload')
    }
    return turn.payload as SpaceTurnRequest
  }

  async completeTurn(
    spaceInstanceId: string,
    turnId: string,
    status: 'completed' | 'failed',
  ) {
    const lease = await this.#lease(spaceInstanceId)
    const response = await this.#control({ action: 'complete_turn', turnId, lease, status })
    if (response.status === 409) {
      this.#leases.delete(spaceInstanceId)
      return false
    }
    if (!response.ok) throw new Error(`Space Turn completion returned ${response.status}`)
    const body = await response.json() as { completed?: unknown }
    return body.completed === true
  }

  async loadAgentSession(input: {
    spaceInstanceId: string
    agentId: string
    sessionId: string
    generation: number
  }) {
    const response = await this.#control({ action: 'load_agent_session', ...input })
    if (!response.ok) throw new Error(`Agent session read returned ${response.status}`)
    const body = await response.json() as { session?: unknown }
    return body.session ? agentSessionRefV1Schema.parse(body.session) : null
  }

  async saveAgentSession(turnId: string, session: AgentSessionRefV1) {
    const lease = await this.#lease(session.spaceInstanceId)
    const response = await this.#control({
      action: 'save_agent_session',
      turnId,
      lease,
      session,
    })
    if (response.status === 409) {
      this.#leases.delete(session.spaceInstanceId)
      throw new Error(`Space Runtime owner was fenced for ${session.spaceInstanceId}`)
    }
    if (!response.ok) throw new Error(`Agent session write returned ${response.status}`)
  }

  async rebuildAgentSession(input: {
    turnId: string
    session: AgentSessionRefV1
  }) {
    const lease = await this.#lease(input.session.spaceInstanceId)
    const response = await this.#control({
      action: 'rebuild_agent_session',
      turnId: input.turnId,
      lease,
      sessionId: input.session.sessionId,
      generation: input.session.generation,
    })
    if (response.status === 409) {
      this.#leases.delete(input.session.spaceInstanceId)
      throw new Error(`Space Runtime owner was fenced for ${input.session.spaceInstanceId}`)
    }
    if (!response.ok) throw new Error(`Agent session rebuild returned ${response.status}`)
    const body = await response.json() as { session?: unknown }
    return agentSessionRefV1Schema.parse(body.session)
  }

  async recordAgentAudit(turnId: string, event: DurableAgentAuditEvent) {
    const lease = await this.#lease(event.spaceInstanceId)
    const response = await this.#control({
      action: 'record_agent_audit',
      turnId,
      lease,
      event,
    })
    if (response.status === 409) {
      this.#leases.delete(event.spaceInstanceId)
      throw new Error(`Space Runtime owner was fenced for ${event.spaceInstanceId}`)
    }
    if (!response.ok) throw new Error(`Agent audit write returned ${response.status}`)
  }

  async getAgentTurnControl(spaceInstanceId: string, turnId: string) {
    const response = await this.#control({
      action: 'get_agent_turn_control',
      spaceInstanceId,
      turnId,
    })
    if (!response.ok) throw new Error(`Agent Turn control read returned ${response.status}`)
    const body = await response.json() as Record<string, unknown>
    if (
      !['queued', 'active', 'completed', 'failed'].includes(String(body.status))
      || (body.cancelRequestedAt !== null
        && typeof body.cancelRequestedAt !== 'string')
    ) throw new Error('Agent Turn control read returned an invalid result')
    return {
      status: body.status as DurableAgentTurnControl['status'],
      cancelRequestedAt: body.cancelRequestedAt as string | null,
    }
  }

  async heartbeat(spaceInstanceId: string) {
    await this.#lease(spaceInstanceId)
  }

  async listRunnableSpaceInstanceIds() {
    const response = await this.#control({ action: 'list_runnable_instances', limit: 100 })
    if (!response.ok) throw new Error(`Space Turn runnable scan returned ${response.status}`)
    const body = await response.json() as { spaceInstanceIds?: unknown }
    if (!Array.isArray(body.spaceInstanceIds)) {
      throw new Error('Space Turn runnable scan returned an invalid result')
    }
    return body.spaceInstanceIds.filter((value): value is string => typeof value === 'string')
  }

  async reconcileOutbox() {
    const response = await this.#control({ action: 'reconcile_outbox' })
    if (!response.ok) throw new Error(`Space Runtime outbox reconcile returned ${response.status}`)
  }

  async #lease(spaceInstanceId: string) {
    const current = this.#leases.get(spaceInstanceId)
    if (current) {
      // The control plane may release a lease before its advertised expiry when
      // an empty turn claim drains the queue. Revalidate cached ownership before
      // every write so an early release cannot turn a locally fresh lease stale.
      const renewed = await this.#control({
        action: 'renew_lease',
        lease: current,
        ttlMs: leaseTtlMs,
      })
      if (renewed.ok) {
        const body = await renewed.json() as { lease?: unknown }
        if (body.lease) {
          const lease = spaceRuntimeLeaseSchema.parse(body.lease)
          this.#leases.set(spaceInstanceId, lease)
          return lease
        }
      }
      this.#leases.delete(spaceInstanceId)
    }
    const claimed = await this.#control({
      action: 'claim_lease',
      spaceInstanceId,
      ownerId: runtimeReplicaOwnerId,
      ttlMs: leaseTtlMs,
    })
    if (!claimed.ok) throw new Error(`Space Runtime lease claim returned ${claimed.status}`)
    const body = await claimed.json() as { lease?: unknown }
    const lease = body.lease ? spaceRuntimeLeaseSchema.parse(body.lease) : null
    if (!lease) throw new Error(`Space Runtime lease is held by another replica for ${spaceInstanceId}`)
    this.#leases.set(spaceInstanceId, lease)
    return lease
  }

  #control(body: Record<string, unknown>) {
    return this.#fetch(controlPath, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  async #fetch(path: string, init: RequestInit) {
    const method = init.method || 'GET'
    const credential = await signSpaceRuntimeCredential({
      secret: this.#signingSecret,
      audience: spaceBackendCallbackAudience,
      subject: 'space-runtime',
      method,
      path,
      ttlSeconds: 60,
    })
    const headers = new Headers(init.headers)
    headers.set('authorization', `Bearer ${credential}`)
    return fetch(new URL(path, this.#origin), { ...init, headers })
  }
}
