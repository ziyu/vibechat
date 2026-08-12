import { createFileRoute } from '@tanstack/react-router'
import { createDefaultSocialService } from '@libs/social'
import { productRequestId, requireProductSession } from '@/lib/product-api'
import { withCfDb } from '@/lib/with-request-db'

export const Route = createFileRoute('/v1/blocks/$userId')({
  server: {
    handlers: {
      DELETE: withCfDb(async ({ request, params }: { request: Request; params: { userId: string } }) => {
        const requestId = productRequestId(request)
        const auth = await requireProductSession(request, requestId)
        if (!auth.ok) return auth.response
        await createDefaultSocialService().unblockUser(auth.session.user.id, params.userId)
        return new Response(null, { status: 204, headers: { 'x-request-id': requestId } })
      }),
    },
  },
})
