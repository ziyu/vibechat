import { createFileRoute } from '@tanstack/react-router'
import { DatabaseRoomRepository } from '@libs/rooms'
import {
  SpaceAgentAuditService,
  SpaceAgentSessionService,
} from '@libs/space-agents'
import { DatabaseSpaceAgentRepository } from '@libs/space-agents/database-repository'
import {
  captureSpaceRuntimeRecoveryManifest,
  DatabaseSpaceRuntimeControlPlane,
  RuntimeFencingError,
  type RuntimeLease,
  type RuntimeTurnRecord,
} from '@libs/space-runtime-control'
import {
  agentTurnInputV1Schema,
  type AgentSessionRefV1,
  type AgentTurnInputV1,
} from '@vibechat/space-agent-contracts'
import {
  spaceRuntimeControlRequestSchema,
  spaceRuntimeStateCallbackSchema,
} from '@vibechat/api-contracts'
import { authorizeSpaceRuntimeCallback } from '@/lib/space-runtime-callback-auth'
import { reconcileSpaceRuntimeOutbox } from '@/lib/space-runtime-outbox-reconciler'
import { withCfDb } from '@/lib/with-request-db'

export const Route = createFileRoute('/v1/internal/space-runtime-control')({
  server: {
    handlers: {
      POST: withCfDb(async ({ request }) => {
        if (!await authorizeSpaceRuntimeCallback(request)) {
          return Response.json({ error: 'unauthorized' }, { status: 401 })
        }
        const parsed = spaceRuntimeControlRequestSchema.safeParse(
          await request.json().catch(() => null),
        )
        if (!parsed.success) {
          return Response.json({ error: 'invalid_control_request' }, { status: 400 })
        }
        const control = new DatabaseSpaceRuntimeControlPlane()
        const agents = new DatabaseSpaceAgentRepository()
        try {
          if (parsed.data.action === 'claim_lease') {
            const instance = await runtimeInstance(parsed.data.spaceInstanceId)
            if (!instance) return notAllowed()
            const lease = await control.claimLease(
              instance.spaceInstanceId,
              parsed.data.ownerId,
              parsed.data.ttlMs,
            )
            return Response.json({ lease: lease ? serializeLease(lease) : null })
          }
          if (parsed.data.action === 'renew_lease') {
            if (!await runtimeInstance(parsed.data.lease.spaceInstanceId)) return notAllowed()
            const lease = await control.renewLease(
              parseLease(parsed.data.lease),
              parsed.data.ttlMs,
            )
            return Response.json({ lease: lease ? serializeLease(lease) : null })
          }
          if (parsed.data.action === 'release_lease') {
            if (!await runtimeInstance(parsed.data.lease.spaceInstanceId)) return notAllowed()
            const released = await control.releaseLease(parseLease(parsed.data.lease))
            return Response.json({ released })
          }
          if (parsed.data.action === 'load_project') {
            const instance = await runtimeInstance(parsed.data.spaceInstanceId)
            if (!instance) return notAllowed()
            const project = await control.loadProject(parsed.data.spaceInstanceId)
            return Response.json({
              projectId: instance.projectId,
              project: project ? { ...project, updatedAt: project.updatedAt.toISOString() } : null,
            })
          }
          if (parsed.data.action === 'load_project_revision') {
            const instance = await runtimeInstance(parsed.data.spaceInstanceId)
            if (!instance) return notAllowed()
            const revision = await control.loadProjectRevision(
              parsed.data.spaceInstanceId,
              parsed.data.revisionId,
            )
            return Response.json({
              revision: revision
                ? { ...revision, createdAt: revision.createdAt.toISOString() }
                : null,
            })
          }
          if (parsed.data.action === 'capture_recovery_manifest') {
            const instance = await runtimeInstance(parsed.data.spaceInstanceId)
            if (!instance) return notAllowed()
            const manifest = await captureSpaceRuntimeRecoveryManifest(
              instance.spaceInstanceId,
            )
            return Response.json({ manifest })
          }
          if (parsed.data.action === 'save_project') {
            const instance = await runtimeInstance(parsed.data.project.spaceInstanceId)
            if (!instance || instance.projectId !== parsed.data.project.projectId) {
              return notAllowed()
            }
            const project = await control.saveProject(
              parsed.data.project,
              parseLease(parsed.data.lease),
            )
            if (project.readyRevisionId) {
              const state = spaceRuntimeStateCallbackSchema.parse({
                spaceInstanceId: project.spaceInstanceId,
                readyRevisionId: project.readyRevisionId,
                publishedRevisionId: project.publishedRevisionId,
                releaseId: project.releaseId,
                sourceHash: project.sourceHash,
                sequence: Date.now(),
              })
              const dedupeKey = [
                state.spaceInstanceId,
                state.readyRevisionId,
                state.publishedRevisionId || 'none',
                state.releaseId || 'none',
              ].join(':')
              await control.enqueueOutbox({
                eventId: `space-v2-state:${stableId(dedupeKey)}`,
                spaceInstanceId: state.spaceInstanceId,
                eventType: 'matrix_v2_state',
                dedupeKey,
                payload: state,
              })
              await reconcileSpaceRuntimeOutbox().catch(() => undefined)
            }
            return Response.json({
              project: { ...project, updatedAt: project.updatedAt.toISOString() },
            })
          }
          if (parsed.data.action === 'load_instance') {
            if (!await runtimeInstance(parsed.data.spaceInstanceId)) return notAllowed()
            const instance = await control.loadInstance(parsed.data.spaceInstanceId)
            return Response.json({
              instance: instance ? { ...instance, updatedAt: instance.updatedAt.toISOString() } : null,
            })
          }
          if (parsed.data.action === 'save_instance') {
            if (!await runtimeInstance(parsed.data.instance.spaceInstanceId)) return notAllowed()
            const instance = await control.saveInstance(
              parsed.data.instance,
              parseLease(parsed.data.lease),
            )
            return Response.json({
              instance: { ...instance, updatedAt: instance.updatedAt.toISOString() },
            })
          }
          if (parsed.data.action === 'enqueue_turn') {
            if (!await runtimeInstance(parsed.data.turn.spaceInstanceId)) return notAllowed()
            const turn = await control.enqueueTurn(parsed.data.turn)
            return Response.json({ turn: serializeTurn(turn) })
          }
          if (parsed.data.action === 'claim_turn') {
            if (!await runtimeInstance(parsed.data.spaceInstanceId)) return notAllowed()
            const lease = await control.claimLease(
              parsed.data.spaceInstanceId,
              parsed.data.ownerId,
              parsed.data.ttlMs,
            )
            if (!lease) return Response.json({ lease: null, turn: null })
            const turn = await control.claimNextTurn(parsed.data.spaceInstanceId, lease)
            if (!turn) {
              await control.releaseLease(lease)
              return Response.json({ lease: null, turn: null })
            }
            return Response.json({
              lease: serializeLease(lease),
              turn: serializeTurn(turn),
            })
          }
          if (parsed.data.action === 'complete_turn') {
            if (!await runtimeInstance(parsed.data.lease.spaceInstanceId)) return notAllowed()
            const completed = await control.completeTurn(
              parsed.data.turnId,
              parseLease(parsed.data.lease),
              parsed.data.status,
            )
            return Response.json({ completed })
          }
          if (parsed.data.action === 'load_agent_session') {
            if (!await runtimeInstance(parsed.data.spaceInstanceId)) return notAllowed()
            const session = await agents.findSession(parsed.data.sessionId)
            if (
              !session
              || session.spaceInstanceId !== parsed.data.spaceInstanceId
              || session.agentId !== parsed.data.agentId
              || session.generation !== parsed.data.generation
            ) return Response.json({ session: null })
            return Response.json({ session })
          }
          if (parsed.data.action === 'save_agent_session') {
            const lease = parseLease(parsed.data.lease)
            const owned = await ownedAgentTurn(
              control,
              parsed.data.turnId,
              lease,
            )
            if (!owned || !sessionMatchesTurn(parsed.data.session, owned.agentTurn, true)) {
              return notAllowed()
            }
            const current = await agents.findSession(parsed.data.session.sessionId)
            if (!current || !sameSessionIdentity(current, parsed.data.session)) {
              return notAllowed()
            }
            await agents.saveSession({
              ...parsed.data.session,
              lastTurnId: parsed.data.turnId,
            })
            return Response.json({ saved: true })
          }
          if (parsed.data.action === 'rebuild_agent_session') {
            const lease = parseLease(parsed.data.lease)
            const owned = await ownedAgentTurn(
              control,
              parsed.data.turnId,
              lease,
            )
            const session = await agents.findSession(parsed.data.sessionId)
            if (
              !owned
              || !session
              || session.generation !== parsed.data.generation
              || !sessionMatchesTurn(session, owned.agentTurn, false)
            ) return notAllowed()
            const rebuilt = await new SpaceAgentSessionService(agents).rebuild({
              session,
            })
            return Response.json({ session: rebuilt })
          }
          if (parsed.data.action === 'record_agent_audit') {
            const lease = parseLease(parsed.data.lease)
            const owned = await ownedAgentTurn(
              control,
              parsed.data.turnId,
              lease,
            )
            const event = parsed.data.event
            if (
              !owned
              || event.spaceInstanceId !== owned.agentTurn.spaceInstanceId
              || event.agentId !== owned.agentTurn.agentId
              || (event.definitionId !== null
                && event.definitionId !== owned.agentTurn.definition.definitionId)
            ) return notAllowed()
            if (event.sessionId) {
              const session = await agents.findSession(event.sessionId)
              if (!session || !sessionMatchesTurn(session, owned.agentTurn, true)) {
                return notAllowed()
              }
            }
            await new SpaceAgentAuditService(agents).record({
              ...event,
              turnId: parsed.data.turnId,
              createdAt: new Date(event.createdAt),
            })
            return Response.json({ recorded: true })
          }
          if (parsed.data.action === 'get_agent_turn_control') {
            if (!await runtimeInstance(parsed.data.spaceInstanceId)) return notAllowed()
            const turn = await control.getTurn(parsed.data.turnId)
            if (!turn || turn.spaceInstanceId !== parsed.data.spaceInstanceId) {
              return notAllowed()
            }
            return Response.json({
              status: turn.status,
              cancelRequestedAt: turn.cancelRequestedAt?.toISOString() || null,
            })
          }
          if (parsed.data.action === 'list_runnable_instances') {
            const spaceInstanceIds = await control.listRunnableSpaceInstanceIds(
              parsed.data.limit,
            )
            return Response.json({ spaceInstanceIds })
          }
          await reconcileSpaceRuntimeOutbox()
          return Response.json({ reconciled: true })
        } catch (error) {
          if (error instanceof RuntimeFencingError) {
            return Response.json({ error: error.code }, { status: 409 })
          }
          throw error
        }
      }),
    },
  },
})

async function runtimeInstance(spaceInstanceId: string) {
  return new DatabaseRoomRepository().getBySpaceInstanceId(spaceInstanceId)
}

function parseLease(lease: {
  spaceInstanceId: string
  ownerId: string
  fencingToken: number
  expiresAt: string
}): RuntimeLease {
  return { ...lease, expiresAt: new Date(lease.expiresAt) }
}

function serializeLease(lease: RuntimeLease) {
  return { ...lease, expiresAt: lease.expiresAt.toISOString() }
}

function serializeTurn(turn: RuntimeTurnRecord) {
  return {
    ...turn,
    cancelRequestedAt: turn.cancelRequestedAt?.toISOString() || null,
    createdAt: turn.createdAt.toISOString(),
    updatedAt: turn.updatedAt.toISOString(),
  }
}

async function ownedAgentTurn(
  control: DatabaseSpaceRuntimeControlPlane,
  turnId: string,
  lease: RuntimeLease,
): Promise<{ turn: RuntimeTurnRecord; agentTurn: AgentTurnInputV1 } | null> {
  await control.assertLease(lease)
  const turn = await control.getTurn(turnId)
  if (
    !turn
    || turn.spaceInstanceId !== lease.spaceInstanceId
    || turn.status !== 'active'
    || turn.ownerId !== lease.ownerId
    || turn.fencingToken !== lease.fencingToken
  ) return null
  const payloadAgentTurn = turn.payload.agentTurn
  const parsed = agentTurnInputV1Schema.safeParse(payloadAgentTurn)
  if (!parsed.success || parsed.data.turnId !== turnId) return null
  return { turn, agentTurn: parsed.data }
}

function sessionMatchesTurn(
  session: AgentSessionRefV1,
  turn: AgentTurnInputV1,
  allowRebuild: boolean,
) {
  const generationMatches = session.generation === turn.sessionGeneration
    || (allowRebuild && session.generation === turn.sessionGeneration + 1)
  return generationMatches
    && session.spaceInstanceId === turn.spaceInstanceId
    && session.agentId === turn.agentId
    && session.definitionId === turn.definition.definitionId
    && session.definitionVersion === turn.definition.version
    && session.adapterKey === turn.definition.adapterKey
    && session.adapterVersion === turn.definition.adapterVersion
}

function sameSessionIdentity(left: AgentSessionRefV1, right: AgentSessionRefV1) {
  return left.sessionId === right.sessionId
    && left.spaceInstanceId === right.spaceInstanceId
    && left.agentId === right.agentId
    && left.definitionId === right.definitionId
    && left.definitionVersion === right.definitionVersion
    && left.adapterKey === right.adapterKey
    && left.adapterVersion === right.adapterVersion
    && left.generation === right.generation
    && left.region === right.region
    && left.createdAt === right.createdAt
}

function notAllowed() {
  return Response.json({ error: 'space_runtime_control_not_allowed' }, { status: 403 })
}

function stableId(value: string) {
  let hash = 2166136261
  for (const character of value) {
    hash ^= character.codePointAt(0) || 0
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}
