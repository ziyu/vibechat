import { createFileRoute } from '@tanstack/react-router'
import { proxyBackendRequest } from '@/lib/backend-proxy'

/**
 * Keep this transport route explicit because `/v1/contacts` would otherwise
 * collide with the localized product page pattern `/contacts`.
 */
export const Route = createFileRoute('/v1/contacts/')({
  server: {
    handlers: {
      GET: ({ request }) => proxyBackendRequest(request),
    },
  },
})
