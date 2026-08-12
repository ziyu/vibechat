import { createFileRoute } from '@tanstack/react-router'
import { socialSnapshotSchema } from '@libs/chat'
import { createDefaultSocialService } from '@libs/social'
import { productRequestId, requireProductSession } from '@/lib/product-api'
import { withCfDb } from '@/lib/with-request-db'

export const Route = createFileRoute('/v1/contacts/')({
  server: {
    handlers: {
      GET: withCfDb(async ({ request }) => {
        const requestId = productRequestId(request)
        const auth = await requireProductSession(request, requestId)
        if (!auth.ok) return auth.response
        const snapshot = socialSnapshotSchema.parse(
          await createDefaultSocialService().getSnapshot(auth.session.user.id),
        )
        return Response.json(snapshot, {
          headers: {
            'cache-control': 'private, no-store',
            'x-request-id': requestId,
          },
        })
      }),
    },
  },
})
