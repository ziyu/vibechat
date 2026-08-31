import { createFileRoute } from '@tanstack/react-router'
import { DatabaseSpaceRuntimeControlPlane } from '@libs/space-runtime-control'
import { spaceAgentBillingCallbackSchema } from '@vibechat/space-agent-contracts'
import { withCfDb } from '@/lib/with-request-db'
import { authorizeSpaceRuntimeCallback } from '@/lib/space-runtime-callback-auth'
import { acceptsSpaceAgentBillingCallback } from '@/lib/space-agent-callbacks'
import { reconcileSpaceRuntimeOutbox } from '@/lib/space-runtime-outbox-reconciler'

export const Route = createFileRoute('/v1/internal/space-agent-billing')({
  server: {
    handlers: {
      POST: withCfDb(async ({ request }) => {
        if (!await authorizeSpaceRuntimeCallback(request)) {
          return Response.json({ error: 'unauthorized' }, { status: 401 })
        }
        const parsed = spaceAgentBillingCallbackSchema.safeParse(await request.json().catch(() => null))
        if (!parsed.success) return Response.json({ error: 'invalid_callback' }, { status: 400 })
        const control = new DatabaseSpaceRuntimeControlPlane()
        const turn = await control.getTurn(parsed.data.turnId)
        if (!acceptsSpaceAgentBillingCallback(turn, parsed.data)) {
          return Response.json({ error: 'space_agent_callback_fenced' }, { status: 409 })
        }
        const outbox = await control.enqueueOutbox({
          eventId: `space-agent-credits:${parsed.data.transactionId}`,
          spaceInstanceId: parsed.data.spaceInstanceId,
          eventType: 'credits_callback',
          dedupeKey: parsed.data.transactionId,
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
