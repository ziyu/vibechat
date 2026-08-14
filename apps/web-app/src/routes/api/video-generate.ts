import { createFileRoute } from '@tanstack/react-router'
import { proxyBackendRequest } from '@/lib/backend-proxy'

// Explicit route prevents `/video-generate` from treating `api` as a locale.
export const Route = createFileRoute('/api/video-generate')({
  server: { handlers: { POST: ({ request }) => proxyBackendRequest(request) } },
})
