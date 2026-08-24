import { createFileRoute } from '@tanstack/react-router'
import { spaceAppChannelSchema } from '@vibechat/api-contracts'
import {
  authorizeSpaceRuntimeRequest,
  ensureSpaceTemplateProject,
  fetchSpaceRuntime,
  proxySpaceRuntimeAppResponse,
} from '@/lib/space-runtime'
import { productApiError } from '@/lib/product-api'
import { withCfDb } from '@/lib/with-request-db'

const spaceAppBootstrapDeadlineMs = 1_500

export const Route = createFileRoute('/v1/spaces/instances/$roomId/app')({
  server: {
    handlers: {
      GET: withCfDb(async ({ request, params }: { request: Request; params: { roomId: string } }) => {
        const access = await authorizeSpaceRuntimeRequest(request, params.roomId)
        if (!access.ok) return access.response
        const requestUrl = new URL(request.url)
        const channel = spaceAppChannelSchema.catch('dev').parse(requestUrl.searchParams.get('channel'))
        const requestedVersion = requestUrl.searchParams.get('version')
        if (requestedVersion && !/^[a-f0-9]{16}$/.test(requestedVersion)) {
          return productApiError(
            access.requestId,
            400,
            'SPACE_APP_REVISION_INVALID',
            'The requested Space App Revision is invalid.',
          )
        }
        const versionQuery = channel === 'dev' && requestedVersion
          ? `?version=${encodeURIComponent(requestedVersion)}`
          : ''
        const path = channel === 'dev'
          ? `/runtime/dev/apps/${encodeURIComponent(access.instance.spaceInstanceId)}/${versionQuery}`
          : `/runtime/apps/${encodeURIComponent(access.instance.spaceInstanceId)}/`
        try {
          const response = await withDeadline((async () => {
            await ensureSpaceTemplateProject(access.instance)
            return fetchSpaceRuntime(path, {
              headers: { accept: request.headers.get('accept') || 'text/html' },
            })
          })(), spaceAppBootstrapDeadlineMs)
          return proxySpaceRuntimeAppResponse(response)
        } catch {
          return proxySpaceRuntimeAppResponse(productApiError(
            access.requestId,
            503,
            'SPACE_RUNTIME_UNAVAILABLE',
            'The Space App Runtime is unavailable.',
          ))
        }
      }),
    },
  },
})

async function withDeadline<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('Space App bootstrap deadline exceeded')), timeoutMs)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}
