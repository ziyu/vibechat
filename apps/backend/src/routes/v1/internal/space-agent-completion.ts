import { createFileRoute } from '@tanstack/react-router'
import { DatabaseRoomRepository } from '@libs/rooms'
import { spaceAgentCompletionCallbackSchema } from '@vibechat/space-agent-contracts'
import { DatabaseSpaceRuntimeControlPlane } from '@libs/space-runtime-control'
import { authorizeSpaceRuntimeCallback } from '@/lib/space-runtime-callback-auth'
import { reconcileSpaceRuntimeOutbox } from '@/lib/space-runtime-outbox-reconciler'
import { withCfDb } from '@/lib/with-request-db'

export const Route = createFileRoute('/v1/internal/space-agent-completion')({
  server: {
    handlers: {
      POST: withCfDb(async ({ request }) => {
        if (!await authorizeSpaceRuntimeCallback(request)) {
          return Response.json({ error: 'unauthorized' }, { status: 401 })
        }
        const parsed = spaceAgentCompletionCallbackSchema.safeParse(
          await request.json().catch(() => null),
        )
        if (!parsed.success) {
          return Response.json({ error: 'invalid_callback' }, { status: 400 })
        }

        const instance = await new DatabaseRoomRepository().getByMatrixRoomId(
          parsed.data.matrixRoomId,
        )
        if (
          !instance
          || instance.spaceInstanceId !== parsed.data.spaceInstanceId
          || instance.defaultAgentId !== parsed.data.agentId
        ) {
          return Response.json({ error: 'space_agent_callback_not_allowed' }, { status: 403 })
        }

        const control = new DatabaseSpaceRuntimeControlPlane()
        const turn = await control.getTurn(parsed.data.turnId)
        if (
          !turn
          || turn.spaceInstanceId !== parsed.data.spaceInstanceId
          || turn.status !== 'completed'
        ) {
          return Response.json({ error: 'space_agent_callback_fenced' }, { status: 409 })
        }
        const outbox = await control.enqueueOutbox({
          eventId: `space-agent-reply:${parsed.data.turnId}`,
          spaceInstanceId: parsed.data.spaceInstanceId,
          eventType: 'agent_reply',
          dedupeKey: parsed.data.turnId,
          payload: parsed.data,
        })
        await reconcileSpaceRuntimeOutbox().catch(() => undefined)
        return Response.json({ accepted: true, eventId: outbox.eventId }, {
          status: 202,
          headers: { 'cache-control': 'no-store' },
        })
      }),
    },
  },
})
