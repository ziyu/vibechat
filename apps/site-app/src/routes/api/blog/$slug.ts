import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/blog/$slug')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const backend = new URL(
          `/api/blog/${encodeURIComponent(params.slug)}`,
          process.env.BACKEND_ORIGIN || 'http://localhost:8002',
        )
        return fetch(backend, { headers: { accept: 'application/json' } })
      },
    },
  },
})
