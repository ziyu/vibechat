import { createFileRoute } from '@tanstack/react-router'
import { proxyBackendRequest } from '@/lib/backend-proxy'

// Explicit route prevents `/upload` from treating `api` as a locale.
export const Route = createFileRoute('/api/upload')({
  server: { handlers: { POST: ({ request }) => proxyBackendRequest(request) } },
})
