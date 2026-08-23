import { createFileRoute } from '@tanstack/react-router'
import {
  authorizeSpaceRuntimeRequest,
  fetchSpaceRuntime,
  proxySpaceRuntimeResponse,
} from '@/lib/space-runtime'
import { productApiError } from '@/lib/product-api'
import { withCfDb } from '@/lib/with-request-db'

export const Route = createFileRoute('/v1/spaces/instances/$roomId/events')({
  server: {
    handlers: {
      GET: withCfDb(async ({ request, params }: { request: Request; params: { roomId: string } }) => {
        const access = await authorizeSpaceRuntimeRequest(request, params.roomId)
        if (!access.ok) return access.response
        try {
          const query = new URLSearchParams({
            clientId: access.session.user.id,
            name: access.session.user.name || 'Member',
          })
          return proxySpaceRuntimeResponse(await fetchSpaceRuntime(
            `/api/apps/${encodeURIComponent(access.instance.spaceInstanceId)}/events?${query}`,
            { headers: { accept: 'text/event-stream' }, signal: request.signal },
          ))
        } catch {
          return productApiError(access.requestId, 503, 'SPACE_RUNTIME_UNAVAILABLE', 'The Space Runtime is unavailable.')
        }
      }),
    },
  },
})
