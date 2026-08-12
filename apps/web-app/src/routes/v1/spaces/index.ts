import { createFileRoute } from '@tanstack/react-router'
import { atmosphereSpaceDirectorySchema, productLocaleSchema } from '@libs/chat'
import { createDefaultProductStateService } from '@libs/product-state'
import {
  productRequestId,
  requireProductSession,
} from '@/lib/product-api'
import { withCfDb } from '@/lib/with-request-db'

export const Route = createFileRoute('/v1/spaces/')({
  server: {
    handlers: {
      GET: withCfDb(async ({ request }) => {
        const requestId = productRequestId(request)
        const auth = await requireProductSession(request, requestId)
        if (!auth.ok) return auth.response
        const url = new URL(request.url)
        const locale = productLocaleSchema.catch('en').parse(url.searchParams.get('locale'))
        const spaces = await createDefaultProductStateService().getSpaceDirectory(locale)
        return Response.json(atmosphereSpaceDirectorySchema.parse({ spaces }), {
          headers: { 'cache-control': 'private, max-age=60', 'x-request-id': requestId },
        })
      }),
    },
  },
})
