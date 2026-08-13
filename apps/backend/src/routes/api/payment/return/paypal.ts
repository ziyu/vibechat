import { createFileRoute } from '@tanstack/react-router'
import { withCfDb } from '@/lib/with-request-db'
import { config } from '@config'

function redirect(url: string) {
  return new Response(null, { status: 302, headers: { Location: url } })
}

export const Route = createFileRoute('/api/payment/return/paypal')({
  server: {
    handlers: {
      GET: withCfDb(async ({ request }) => {
        const url = new URL(request.url)
        const orderId = url.searchParams.get('order_id')
        const isSubscription = url.searchParams.get('subscription') === 'true'
        if (!orderId) return redirect(`${config.app.payment.cancelUrl}?provider=paypal`)

        try {
          const [{ auth }, { db }, { order }, { eq }, payment] = await Promise.all([
            import('@libs/auth'),
            import('@libs/database'),
            import('@libs/database/schema/order'),
            import('drizzle-orm'),
            import('@libs/payment'),
          ])
          const session = await auth.api.getSession({ headers: new Headers(request.headers) })
          if (!session?.user?.id) return redirect(`/${config.app.i18n.defaultLocale}/signin`)

          const [orderRecord] = await db.select().from(order)
            .where(eq(order.id, orderId)).limit(1)
          if (!orderRecord || orderRecord.userId !== session.user.id || orderRecord.provider !== 'paypal' || !orderRecord.providerOrderId) {
            return redirect(`${config.app.payment.cancelUrl}?provider=paypal&order_id=${orderId}`)
          }

          const paypalProvider = await payment.createPaymentProvider('paypal')
          if (isSubscription) {
            const details = await paypalProvider.getSubscription(orderRecord.providerOrderId)
            if (details?.status !== 'ACTIVE') {
              return redirect(`${config.app.payment.cancelUrl}?provider=paypal&order_id=${orderId}`)
            }
            const periodStart = details.start_time ? new Date(details.start_time) : new Date()
            const periodEnd = details.billing_info?.next_billing_time
              ? new Date(details.billing_info.next_billing_time)
              : null
            await payment.fulfillPaidOrder({
              orderId,
              providerOrderId: orderRecord.providerOrderId,
              providerEventId: `paypal-return:${orderRecord.providerOrderId}`,
              subscriptionId: details.id,
              periodStart,
              periodEnd,
              reportedUserId: session.user.id,
              reportedPlanId: orderRecord.planId,
              providerProductId: details.plan_id,
              metadata: { paypalPlanId: details.plan_id, processedBy: 'return' },
            })
            return redirect(`${config.app.payment.successUrl}?provider=paypal&order_id=${orderId}&subscription=true`)
          }

          const capture = await paypalProvider.captureOrder(orderRecord.providerOrderId)
          if (capture.status !== 'COMPLETED') {
            return redirect(`${config.app.payment.cancelUrl}?provider=paypal&order_id=${orderId}`)
          }
          const captured = capture.purchase_units?.[0]?.payments?.captures?.[0]
          await payment.fulfillPaidOrder({
            orderId,
            providerOrderId: orderRecord.providerOrderId,
            providerEventId: captured?.id || `paypal-return:${orderRecord.providerOrderId}`,
            paidAmount: captured?.amount?.value ? Number(captured.amount.value) : null,
            paidCurrency: captured?.amount?.currency_code || null,
            reportedUserId: session.user.id,
            reportedPlanId: orderRecord.planId,
            metadata: { paypalCaptureId: captured?.id || null, processedBy: 'return' },
          })
          return redirect(`${config.app.payment.successUrl}?provider=paypal&order_id=${orderId}&paypal_capture=success`)
        } catch (error) {
          const { summarizePaymentError } = await import('@libs/payment')
          console.error('PayPal return processing error:', summarizePaymentError(error))
          return redirect(`${config.app.payment.cancelUrl}?provider=paypal&order_id=${orderId}`)
        }
      }),
    },
  },
})
