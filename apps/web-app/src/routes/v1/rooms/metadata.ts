import { createFileRoute } from '@tanstack/react-router'
import { proxyBackendRequest } from '@/lib/backend-proxy'

/**
 * Explicit transport route prevents `/v1/rooms/metadata` from being treated
 * as the localized product page `/$lang/rooms/$roomId`.
 */
export const Route = createFileRoute('/v1/rooms/metadata')({
  server: {
    handlers: {
      GET: ({ request }) => proxyBackendRequest(request),
      POST: ({ request }) => proxyBackendRequest(request),
      PATCH: ({ request }) => proxyBackendRequest(request),
    },
  },
})
