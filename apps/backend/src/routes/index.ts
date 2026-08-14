import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  server: {
    handlers: {
      GET: () => Response.json({
        service: 'vibechat-backend',
        health: '/api/health',
      }),
    },
  },
})
