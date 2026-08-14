import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/blog/')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const incoming = new URL(request.url)
        const backend = new URL('/api/blog', process.env.BACKEND_ORIGIN || 'http://localhost:8002')
        backend.search = incoming.search
        return fetch(backend, { headers: { accept: 'application/json' } })
      },
    },
  },
})
