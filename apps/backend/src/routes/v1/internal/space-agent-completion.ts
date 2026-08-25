import { createFileRoute } from '@tanstack/react-router'
import { DatabaseRoomRepository } from '@libs/rooms'
import { spaceAgentCompletionCallbackSchema } from '@vibechat/api-contracts'
import { writeMatrixAgentReply } from '@/lib/matrix-agent-reply'
import { withCfDb } from '@/lib/with-request-db'

export const Route = createFileRoute('/v1/internal/space-agent-completion')({
  server: {
    handlers: {
      POST: withCfDb(async ({ request }) => {
        const token = process.env.SPACE_RUNTIME_INTERNAL_TOKEN?.trim()
        if (!token || request.headers.get('authorization') !== `Bearer ${token}`) {
          return Response.json({ error: 'unauthorized' }, { status: 401 })
        }
        const parsed = spaceAgentCompletionCallbackSchema.safeParse(
          await request.json().catch(() => null),
        )
        if (!parsed.success) {
          return Response.json({ error: 'invalid_callback' }, { status: 400 })
        }

        const [instance] = await new DatabaseRoomRepository().getAccessibleByMatrixRoomIds(
          parsed.data.userId,
          [parsed.data.matrixRoomId],
        )
        if (
          !instance
          || instance.spaceInstanceId !== parsed.data.spaceInstanceId
          || instance.defaultAgentId !== parsed.data.agentId
        ) {
          return Response.json({ error: 'space_agent_callback_not_allowed' }, { status: 403 })
        }

        const result = await writeMatrixAgentReply(parsed.data)
        return Response.json({ ok: true, ...result }, {
          headers: { 'cache-control': 'no-store' },
        })
      }),
    },
  },
})
