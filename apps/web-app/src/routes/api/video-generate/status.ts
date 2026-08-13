import { createFileRoute } from '@tanstack/react-router'
import { proxyBackendRequest } from '@/lib/backend-proxy'

export const Route = createFileRoute('/api/video-generate/status')({
  server: { handlers: { GET: ({ request }) => proxyBackendRequest(request) } },
})
