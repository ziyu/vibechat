import {
  agentTurnInputV1Schema,
  type AgentPolicySnapshotV1,
  type AgentTurnInputV1,
} from '@vibechat/space-agent-contracts'
import {
  spaceTurnAcceptedSchema,
  type CreateSpaceAgentTurnRequest,
  type SpaceTurnAccepted,
} from '@vibechat/api-contracts'
import type { ChatBillingContext } from '@libs/ai'
import type { SpaceInstanceRecord } from '@libs/rooms/types'
import type { RuntimeProjectPointer } from '@libs/space-runtime-control'
import {
  createDefaultPiBinding,
  defaultPiAgentId,
  SpaceAgentBindingService,
  SpaceAgentRegistryService,
  SpaceAgentSessionService,
  type SpaceAgentResolution,
} from '@libs/space-agents'
type CreditReservation = Awaited<
  ReturnType<typeof import('@libs/ai').reserveChatCredits>
>

export interface SpaceAgentRuntimeEnqueueInput {
  turnId: string
  message: string
  matrixEventId: string
  agentId: string
  clientId: string
  authorName: string
  agentTurn: AgentTurnInputV1
  billing: {
    callbackUrl: string
    spaceInstanceId: string
    completion: {
      callbackUrl: string
      spaceInstanceId: string
      matrixRoomId: string
      matrixEventId: string
    }
    userId: string
    requestId: string
    provider: string
    model: string
    reservedCredits: number
    transactionId: string
  }
}

export interface SpaceAgentInvocationDependencies {
  bindings: Pick<SpaceAgentBindingService, 'resolveForInvocation'>
  sessions: Pick<SpaceAgentSessionService, 'getOrCreate'>
  verifyMention: typeof import('./matrix-agent-mention').verifyMatrixAgentMention
  reserveCredits: typeof import('@libs/ai').reserveChatCredits
  refundCredits: typeof import('@libs/ai').refundChatCredits
  ensureProject: typeof import('./space-runtime').ensureSpaceTemplateProject
  loadProject(spaceInstanceId: string): Promise<RuntimeProjectPointer | null>
  enqueueRuntime(input: SpaceAgentRuntimeEnqueueInput): Promise<unknown>
  createTurnId(): string
  now(): Date
  region: string
  allowMultipleAgents: boolean
}

export interface InvokeSpaceAgentInput {
  instance: SpaceInstanceRecord
  user: {
    id: string
    name: string | null | undefined
  }
  request: CreateSpaceAgentTurnRequest
}

export class SpaceAgentInvocationError extends Error {
  constructor(
    readonly status: 400 | 402 | 403 | 503,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'SpaceAgentInvocationError'
  }
}

export class SpaceAgentInvocationService {
  constructor(private readonly dependencies: SpaceAgentInvocationDependencies) {}

  async invoke(input: InvokeSpaceAgentInput): Promise<SpaceTurnAccepted> {
    const agentId = input.request.agentMention.id
    const billingContext: ChatBillingContext = {
      userId: input.user.id,
      requestId: `space-agent:${input.instance.spaceInstanceId}:${stableRequestId(input.request.matrixEventId)}`,
      provider: 'space-agent',
      model: agentId,
    }
    let reservation: CreditReservation | undefined

    try {
      if (!this.dependencies.allowMultipleAgents && agentId !== defaultPiAgentId) {
        throw notAllowed('The mentioned Agent is not enabled for this Space.')
      }
      const resolution = await this.dependencies.bindings.resolveForInvocation({
        spaceInstanceId: input.instance.spaceInstanceId,
        requestedAgentId: agentId,
        legacyDefaultAgentId: input.instance.defaultAgentId,
      })
      if (resolution.status === 'denied') throw resolutionError(resolution)
      if (!resolution.binding && resolution.agentId !== defaultPiAgentId) {
        throw notAllowed('The mentioned Agent requires an explicit Space binding.')
      }
      if (!definitionAllowsRegion(resolution.definition, this.dependencies.region)) {
        throw new SpaceAgentInvocationError(
          403,
          'SPACE_AGENT_REGION_NOT_ALLOWED',
          'The mentioned Agent is not available in this Space region.',
        )
      }

      const verifiedMention = await this.dependencies.verifyMention({
        userId: input.user.id,
        matrixRoomId: input.instance.matrixRoomId,
        matrixEventId: input.request.matrixEventId,
        agentMention: input.request.agentMention,
      })
      if (!verifiedMention) {
        throw new SpaceAgentInvocationError(
          400,
          'SPACE_AGENT_MENTION_REQUIRED',
          'A verified Agent mention is required to start a turn.',
        )
      }

      reservation = await this.dependencies.reserveCredits(billingContext, [{
        id: input.request.matrixEventId,
        role: 'user',
        parts: [{ type: 'text', text: input.request.message }],
      }] as never)
      if (!reservation.success) {
        throw new SpaceAgentInvocationError(
          402,
          'INSUFFICIENT_CREDITS',
          reservation.error || 'Not enough credits.',
          {
            required: reservation.reservedCredits,
            balance: reservation.newBalance,
          },
        )
      }
      if (!reservation.transactionId) {
        throw new Error('SPACE_AGENT_RESERVATION_INVALID')
      }

      const requestedAt = this.dependencies.now()
      const policy = invocationPolicy(
        resolution,
        input.instance.spaceInstanceId,
        requestedAt,
      )
      if (reservation.reservedCredits > policy.maxCredits) {
        throw new SpaceAgentInvocationError(
          402,
          'SPACE_AGENT_BUDGET_EXCEEDED',
          'The Agent request exceeds this Space budget policy.',
          {
            required: reservation.reservedCredits,
            maximum: policy.maxCredits,
          },
        )
      }

      await this.dependencies.ensureProject(input.instance)
      const project = await this.dependencies.loadProject(input.instance.spaceInstanceId)
      if (
        !project
        || project.projectId !== input.instance.projectId
        || !project.readyRevisionId
        || !project.sourceHash
      ) {
        throw new Error('SPACE_AGENT_PROJECT_SNAPSHOT_UNAVAILABLE')
      }
      const session = await this.dependencies.sessions.getOrCreate({
        spaceInstanceId: input.instance.spaceInstanceId,
        definition: resolution.definition,
        region: this.dependencies.region,
        now: requestedAt,
      })
      const turnId = this.dependencies.createTurnId()
      const agentTurn = agentTurnInputV1Schema.parse({
        schemaVersion: 'vibechat.agent-turn-input/v1',
        turnId,
        spaceInstanceId: input.instance.spaceInstanceId,
        agentId: resolution.agentId,
        sessionId: session.sessionId,
        sessionGeneration: session.generation,
        definition: resolution.definition,
        policy,
        context: {
          matrixEventIds: [input.request.matrixEventId],
          messageWindowRef: null,
          summaryRef: session.summaryRef,
        },
        project: {
          projectId: project.projectId,
          revisionId: project.readyRevisionId,
          sourceHash: project.sourceHash,
        },
        requestText: input.request.message,
        requestedAt: requestedAt.toISOString(),
      })
      const accepted = await this.dependencies.enqueueRuntime({
        turnId,
        message: input.request.message,
        matrixEventId: input.request.matrixEventId,
        agentId: resolution.agentId,
        clientId: input.user.id,
        authorName: input.user.name || 'Member',
        agentTurn,
        billing: runtimeBilling({
          input,
          billingContext,
          reservation: {
            ...reservation,
            success: true,
            transactionId: reservation.transactionId,
          },
        }),
      })
      return spaceTurnAcceptedSchema.parse(accepted)
    } catch (error) {
      if (reservation?.success && !reservation.idempotent) {
        await this.dependencies.refundCredits(
          billingContext,
          reservation,
          error instanceof SpaceAgentInvocationError
            ? error.code.toLowerCase()
            : 'space_runtime_rejected',
        ).catch(() => undefined)
      }
      if (error instanceof SpaceAgentInvocationError) throw error
      throw new SpaceAgentInvocationError(
        503,
        'SPACE_RUNTIME_UNAVAILABLE',
        'The Space Runtime is unavailable.',
      )
    }
  }
}

export async function createSpaceAgentInvocationService() {
  const [
    { DatabaseSpaceAgentRepository },
    { DatabaseSpaceRuntimeControlPlane },
    { verifyMatrixAgentMention },
    { ensureSpaceTemplateProject, fetchSpaceRuntime, runtimeJsonInit },
  ] = await Promise.all([
    import('@libs/space-agents/database-repository'),
    import('@libs/space-runtime-control/database-repository'),
    import('./matrix-agent-mention'),
    import('./space-runtime'),
  ])
  const repository = new DatabaseSpaceAgentRepository()
  const registry = new SpaceAgentRegistryService(repository)
  const control = new DatabaseSpaceRuntimeControlPlane()
  return new SpaceAgentInvocationService({
    bindings: new SpaceAgentBindingService(repository, registry),
    sessions: new SpaceAgentSessionService(repository),
    verifyMention: verifyMatrixAgentMention,
    reserveCredits: async (...args) => {
      const ai = await import('@libs/ai')
      return ai.reserveChatCredits(...args)
    },
    refundCredits: async (...args) => {
      const ai = await import('@libs/ai')
      return ai.refundChatCredits(...args)
    },
    ensureProject: ensureSpaceTemplateProject,
    loadProject: (spaceInstanceId) => control.loadProject(spaceInstanceId),
    enqueueRuntime: async (input) => {
      const response = await fetchSpaceRuntime(
        `/api/apps/${encodeURIComponent(input.agentTurn.spaceInstanceId)}/messages`,
        runtimeJsonInit(input),
      )
      if (!response.ok) throw new Error('SPACE_RUNTIME_REJECTED')
      return response.json()
    },
    createTurnId: () => globalThis.crypto.randomUUID(),
    now: () => new Date(),
    region: process.env.SPACE_AGENT_REGION?.trim() || 'local',
    allowMultipleAgents: process.env.SPACE_AGENT_MULTI_AGENT_ENABLED === '1',
  })
}

function invocationPolicy(
  resolution: Extract<SpaceAgentResolution, { status: 'resolved' }>,
  spaceInstanceId: string,
  now: Date,
): AgentPolicySnapshotV1 {
  const binding = resolution.binding || createDefaultPiBinding(
    spaceInstanceId,
    now,
  )
  return {
    schemaVersion: 'vibechat.agent-policy/v1',
    policySnapshotHash: binding.policySnapshotHash,
    permissionPolicyId: binding.permissionPolicyId,
    toolPolicyId: binding.toolPolicyId,
    pricingPolicyId: resolution.definition.pricingPolicyId,
    maxCredits: Math.min(
      binding.budgetPolicy.maxCreditsPerTurn,
      resolution.definition.maxBudgetCredits,
    ),
    maxInputTokens: binding.budgetPolicy.maxInputTokens,
    maxOutputTokens: binding.budgetPolicy.maxOutputTokens,
    allowedTools: [],
  }
}

function definitionAllowsRegion(
  definition: Extract<SpaceAgentResolution, { status: 'resolved' }>['definition'],
  region: string,
) {
  return definition.dataRegionPolicy.mode === 'any'
    || definition.dataRegionPolicy.regions.includes(region)
}

function runtimeBilling(input: {
  input: InvokeSpaceAgentInput
  billingContext: ChatBillingContext
  reservation: CreditReservation & { success: true }
}) {
  const callbackOrigin = process.env.SPACE_RUNTIME_CALLBACK_ORIGIN?.trim()
    || 'http://localhost:8002'
  return {
    callbackUrl: new URL('/v1/internal/space-agent-billing', callbackOrigin).href,
    spaceInstanceId: input.input.instance.spaceInstanceId,
    completion: {
      callbackUrl: new URL('/v1/internal/space-agent-completion', callbackOrigin).href,
      spaceInstanceId: input.input.instance.spaceInstanceId,
      matrixRoomId: input.input.instance.matrixRoomId,
      matrixEventId: input.input.request.matrixEventId,
    },
    userId: input.input.user.id,
    requestId: input.billingContext.requestId,
    provider: input.billingContext.provider,
    model: input.billingContext.model,
    reservedCredits: input.reservation.reservedCredits,
    transactionId: input.reservation.transactionId,
  }
}

function resolutionError(
  resolution: Extract<SpaceAgentResolution, { status: 'denied' }>,
) {
  if (resolution.reason === 'definition_unavailable') {
    return new SpaceAgentInvocationError(
      503,
      'SPACE_AGENT_NOT_AVAILABLE',
      'The mentioned Agent is currently unavailable.',
    )
  }
  return notAllowed('The mentioned Agent is not enabled for this Space.')
}

function notAllowed(message: string) {
  return new SpaceAgentInvocationError(403, 'SPACE_AGENT_NOT_ALLOWED', message)
}

export function stableRequestId(value: string) {
  let hash = 2166136261
  for (const character of value) {
    hash ^= character.codePointAt(0) || 0
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}
