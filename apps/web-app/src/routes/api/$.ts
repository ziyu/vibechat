import { createFileRoute } from '@tanstack/react-router'
import { proxyBackendRequest } from '@/lib/backend-proxy'

export const Route = createFileRoute('/api/$')({
  server: {
    handlers: {
      GET: ({ request }) => proxyBackendRequest(request),
      POST: ({ request }) => proxyBackendRequest(request),
      PUT: ({ request }) => proxyBackendRequest(request),
      PATCH: ({ request }) => proxyBackendRequest(request),
      DELETE: ({ request }) => proxyBackendRequest(request),
      HEAD: ({ request }) => proxyBackendRequest(request),
      OPTIONS: ({ request }) => proxyBackendRequest(request),
    },
  },
})
