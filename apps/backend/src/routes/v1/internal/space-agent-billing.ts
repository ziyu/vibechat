import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { withCfDb } from '@/lib/with-request-db'

const callbackSchema = z.object({
  userId: z.string().min(1),
  requestId: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  reservedCredits: z.number().int().positive(),
  transactionId: z.string().min(1),
  status: z.enum(['completed', 'failed']),
  usage: z.object({
    inputTokens: z.number().int().nonnegative().optional(),
    outputTokens: z.number().int().nonnegative().optional(),
    totalTokens: z.number().int().nonnegative().optional(),
  }).optional(),
})

export const Route = createFileRoute('/v1/internal/space-agent-billing')({
  server: {
    handlers: {
      POST: withCfDb(async ({ request }) => {
        const token = process.env.SPACE_RUNTIME_INTERNAL_TOKEN?.trim()
        if (!token || request.headers.get('authorization') !== `Bearer ${token}`) {
          return Response.json({ error: 'unauthorized' }, { status: 401 })
        }
        const parsed = callbackSchema.safeParse(await request.json().catch(() => null))
        if (!parsed.success) return Response.json({ error: 'invalid_callback' }, { status: 400 })
        const ai = await import('@libs/ai')
        const context = {
          userId: parsed.data.userId,
          requestId: parsed.data.requestId,
          provider: parsed.data.provider,
          model: parsed.data.model,
        }
        const reservation = {
          reservedCredits: parsed.data.reservedCredits,
          transactionId: parsed.data.transactionId,
        }
        if (parsed.data.status === 'failed') {
          await ai.refundChatCredits(context, reservation, 'space_agent_failed')
        } else {
          await ai.settleChatCredits(context, reservation, parsed.data.usage || {})
        }
        return Response.json({ ok: true }, { headers: { 'cache-control': 'no-store' } })
      }),
    },
  },
})
