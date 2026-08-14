import { createFileRoute } from '@tanstack/react-router'
import { withCfDb } from '@/lib/with-request-db'
import { nanoid } from 'nanoid'
import { paymentInitiateInputSchema } from '@vibechat/api-contracts/account'

const SUPPORTED_PROVIDERS = new Set(['stripe', 'wechat', 'creem', 'alipay', 'paypal', 'dodo'])

export const Route = createFileRoute('/api/payment/initiate')({
  server: {
    handlers: {
      POST: withCfDb(async ({ request }) => {
        let createdOrderId: string | undefined
        try {
          const { auth } = await import('@libs/auth')
          const { createPaymentProvider } = await import('@libs/payment')
          const { db } = await import('@libs/database')
          const { order, orderStatus, paymentProviders } = await import('@libs/database/schema/order')
          const { eq } = await import('drizzle-orm')
          const { getPurchasablePlanById } = await import('@libs/pricing')

          const session = await auth.api.getSession({ headers: new Headers(request.headers) })
          if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

          const parsed = paymentInitiateInputSchema.safeParse(await request.json().catch(() => null))
          if (!parsed.success) return Response.json({ error: 'Invalid payment request', details: parsed.error.flatten() }, { status: 400 })
          const { planId, provider = paymentProviders.STRIPE, requestId } = parsed.data
          if (typeof provider !== 'string' || !SUPPORTED_PROVIDERS.has(provider)) {
            return Response.json({ error: 'Unsupported payment provider' }, { status: 400 })
          }

          const orderId = requestId || nanoid()
          const plan = await getPurchasablePlanById(planId)
          if (!plan) return Response.json({ error: 'Invalid plan' }, { status: 400 })
          if (plan.provider !== provider) {
            return Response.json({ error: 'Payment provider does not match plan' }, { status: 400 })
          }

          const [existingOrder] = await db.select().from(order).where(eq(order.id, orderId)).limit(1)
          if (existingOrder) {
            if (existingOrder.userId !== session.user.id) return Response.json({ error: 'Order not found' }, { status: 404 })
            if (existingOrder.planId !== planId || existingOrder.provider !== provider) return Response.json({ error: 'Payment request id collision' }, { status: 409 })
            const existingMetadata = existingOrder.metadata as Record<string, unknown> | null
            if (existingOrder.providerOrderId && typeof existingMetadata?.checkoutUrl === 'string') {
              return Response.json({
                paymentUrl: existingMetadata.checkoutUrl,
                providerOrderId: existingOrder.providerOrderId,
                idempotent: true,
              })
            }
            return Response.json({
              error: existingOrder.status === orderStatus.FAILED ? 'checkout_failed' : 'checkout_processing',
              message: existingOrder.status === orderStatus.FAILED
                ? 'This payment request failed; retry with a new requestId'
                : 'Payment request is already processing',
            }, { status: 409 })
          }

          // Build referral metadata for commission tracking
          const { user: userTable } = await import('@libs/database/schema')
          const orderMetadata: Record<string, string> = {}
          try {
            const userRecord = await db.select({ referredByCode: userTable.referredByCode }).from(userTable).where(eq(userTable.id, session.user.id)).limit(1)
            const referralCode = userRecord[0]?.referredByCode
            if (referralCode) {
              const referrer = await db.select({ id: userTable.id }).from(userTable).where(eq(userTable.referralCode, referralCode)).limit(1)
              if (referrer.length && referrer[0].id !== session.user.id) {
                orderMetadata.referralCode = referralCode
                orderMetadata.referrerId = referrer[0].id
              }
            }
          } catch {
            console.warn('[Payment] Failed to resolve referral metadata')
          }

          await db.insert(order).values({
            id: orderId,
            userId: session.user.id,
            planId,
            amount: plan.amount.toString(),
            currency: plan.currency,
            status: orderStatus.PENDING,
            provider,
            metadata: orderMetadata,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          createdOrderId = orderId

          const paymentProvider = await createPaymentProvider(provider as import('@libs/payment').PaymentProviderType)
          const forwardedFor = request.headers.get('x-forwarded-for')
          const realIp = request.headers.get('x-real-ip')
          const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : realIp || '127.0.0.1'

          const result = await paymentProvider.createPayment({
            orderId,
            userId: session.user.id,
            planId,
            amount: plan.amount,
            currency: plan.currency,
            plan,
            metadata: { clientIp },
          })

          await db.update(order).set({
            providerOrderId: result.providerOrderId,
            metadata: { ...orderMetadata, ...(result.metadata || {}), checkoutUrl: result.paymentUrl },
            updatedAt: new Date(),
          }).where(eq(order.id, orderId))

          return Response.json({
            paymentUrl: result.paymentUrl,
            providerOrderId: result.providerOrderId,
          })
        } catch (error) {
          const { summarizePaymentError } = await import('@libs/payment')
          console.error('Payment initiation error:', summarizePaymentError(error))
          if (createdOrderId) {
            try {
              const { db } = await import('@libs/database')
              const { order, orderStatus } = await import('@libs/database/schema/order')
              const { eq } = await import('drizzle-orm')
              await db.update(order).set({
                status: orderStatus.FAILED,
                updatedAt: new Date(),
              }).where(eq(order.id, createdOrderId))
            } catch (updateError) {
              console.error('Failed to terminate checkout order:', {
                createdOrderId,
                error: summarizePaymentError(updateError),
              })
            }
          }
          return Response.json({
            error: 'checkout_unavailable',
            message: 'Payment provider checkout is unavailable',
          }, { status: 503 })
        }
      }),
    },
  },
})
