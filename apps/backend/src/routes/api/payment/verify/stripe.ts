import { createFileRoute } from '@tanstack/react-router'
import { withCfDb } from '@/lib/with-request-db'
import { config } from '@config'

export const Route = createFileRoute('/api/payment/verify/stripe')({
  server: {
    handlers: {
      GET: withCfDb(async ({ request }) => {
        try {
          const [{ auth }, { db }, { order }, { and, eq }] = await Promise.all([
            import('@libs/auth'),
            import('@libs/database'),
            import('@libs/database/schema/order'),
            import('drizzle-orm'),
          ])
          const authSession = await auth.api.getSession({ headers: new Headers(request.headers) })
          if (!authSession?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

          const Stripe = (await import('stripe')).default
          const stripe = new Stripe(config.payment.providers.stripe.secretKey, {
            apiVersion: '2025-04-30.basil',
          })

          const url = new URL(request.url)
          const sessionId = url.searchParams.get('session_id')
          if (!sessionId) return Response.json({ error: 'Session ID is required' }, { status: 400 })

          const [localOrder] = await db.select({ id: order.id }).from(order).where(and(
            eq(order.userId, authSession.user.id),
            eq(order.provider, 'stripe'),
            eq(order.providerOrderId, sessionId),
          )).limit(1)
          if (!localOrder) return Response.json({ error: 'Session not found' }, { status: 404 })

          const session = await stripe.checkout.sessions.retrieve(sessionId)
          if (!session || !session.payment_status) return Response.json({ error: 'Invalid session' }, { status: 400 })
          if (session.metadata?.orderId !== localOrder.id || session.metadata?.userId !== authSession.user.id) {
            return Response.json({ error: 'Session ownership mismatch' }, { status: 403 })
          }
          if (session.payment_status !== 'paid') return Response.json({ error: 'Payment not completed' }, { status: 400 })

          return Response.json({ success: true })
        } catch (error) {
          const { summarizePaymentError } = await import('@libs/payment')
          console.error('Session verification failed:', summarizePaymentError(error))
          return Response.json({ error: 'Session verification failed' }, { status: 500 })
        }
      }),
    },
  },
})
