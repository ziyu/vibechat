import { createFileRoute } from '@tanstack/react-router'
import { spaceAppChannelSchema } from '@vibechat/api-contracts'
import {
  authorizeSpaceRuntimeRequest,
  fetchSpaceRuntime,
  proxySpaceRuntimeResponse,
} from '@/lib/space-runtime'
import { productApiError } from '@/lib/product-api'
import { withCfDb } from '@/lib/with-request-db'

export const Route = createFileRoute('/v1/spaces/instances/$roomId/app')({
  server: {
    handlers: {
      GET: withCfDb(async ({ request, params }: { request: Request; params: { roomId: string } }) => {
        const access = await authorizeSpaceRuntimeRequest(request, params.roomId)
        if (!access.ok) return access.response
        const channel = spaceAppChannelSchema.catch('dev').parse(new URL(request.url).searchParams.get('channel'))
        const path = channel === 'dev'
          ? `/runtime/dev/apps/${encodeURIComponent(access.instance.spaceInstanceId)}/`
          : `/runtime/apps/${encodeURIComponent(access.instance.spaceInstanceId)}/`
        try {
          return proxySpaceRuntimeResponse(await fetchSpaceRuntime(path, {
            headers: { accept: request.headers.get('accept') || 'text/html' },
          }), { app: true })
        } catch {
          return productApiError(access.requestId, 503, 'SPACE_APP_UNAVAILABLE', 'The Space App is unavailable.')
        }
      }),
    },
  },
})
