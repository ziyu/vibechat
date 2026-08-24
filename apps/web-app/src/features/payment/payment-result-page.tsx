'use client'

import { Link } from '@tanstack/react-router'
import { CheckCircle2, Clock3, RefreshCcw, XCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { OrdersResponse } from '@vibechat/api-contracts'
import { ProductApiClient } from '@vibechat/product-client'
import { useTranslation } from '@/hooks/use-translation'

const paymentApi = new ProductApiClient()
type VerificationState = 'checking' | 'paid' | 'pending' | 'failed'

export function PaymentResultPage({ mode }: { mode: 'success' | 'cancel' }) {
  const { t, locale } = useTranslation()
  const [state, setState] = useState<VerificationState>(mode === 'cancel' ? 'failed' : 'checking')
  const [attempt, setAttempt] = useState(0)
  const query = useMemo(() => typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search), [])
  const provider = query.get('provider') || ''
  const orderId = query.get('order_id') || ''
  const providerOrderId = query.get('session_id') || ''

  const resolveOrder = useCallback((orders: OrdersResponse['orders']) => {
    const matched = orderId
      ? orders.find((order) => order.id === orderId)
      : providerOrderId
        ? orders.find((order) => order.providerOrderId === providerOrderId)
        : orders.find((order) => !provider || order.provider === provider)
    if (!matched) return 'pending' as const
    if (matched.status === 'paid' || matched.status === 'completed') return 'paid' as const
    if (matched.status === 'failed' || matched.status === 'canceled') return 'failed' as const
    return 'pending' as const
  }, [orderId, provider, providerOrderId])

  const verify = useCallback(async () => {
    if (mode === 'cancel') return
    setState('checking')
    try {
      const next = resolveOrder((await paymentApi.getOrders(1, 20)).orders)
      setState(next)
      if (next === 'pending') setAttempt((value) => value + 1)
    } catch {
      setState('pending')
    }
  }, [mode, resolveOrder])

  useEffect(() => { void verify() }, [verify])
  useEffect(() => {
    if (state !== 'pending' || attempt >= 15 || mode === 'cancel') return
    const timer = window.setTimeout(() => void verify(), 2000)
    return () => window.clearTimeout(timer)
  }, [attempt, mode, state, verify])

  const paid = mode === 'success' && state === 'paid'
  const checking = mode === 'success' && (state === 'checking' || state === 'pending')
  return (
    <section className="vc-payment-result" data-testid={`payment-${mode}-page`} data-state={paid ? 'paid' : checking ? 'checking' : 'failed'}>
      <div className="vc-payment-result-card">
        <span className="vc-payment-result-icon">
          {paid ? <CheckCircle2 /> : checking ? <Clock3 /> : <XCircle />}
        </span>
        <small>{provider ? provider.toUpperCase() : 'VIBE CHAT'} · PAYMENT</small>
        <h1>{paid ? t.payment.result.success.title : mode === 'cancel' ? t.payment.result.cancel.title : state === 'failed' ? t.payment.result.failed : t.payment.steps.payDesc}</h1>
        <p>{paid ? t.payment.result.success.description : mode === 'cancel' ? t.payment.result.cancel.description : state === 'failed' ? t.payment.result.failed : t.payment.steps.payDesc}</p>
        {checking ? <div className="vc-payment-checking"><RefreshCcw className="vc-spin" />{attempt < 15 ? t.payment.steps.payDesc : t.payment.result.failed}</div> : null}
        <div className="vc-payment-result-actions">
          {mode === 'success' ? <Link to="/account">{t.payment.result.success.actions.viewSubscription}</Link> : <Link to="/services">{t.payment.result.cancel.actions.tryAgain}</Link>}
          <Link to="/spaces" data-quiet>{mode === 'success' ? t.payment.result.success.actions.backToHome : t.payment.result.cancel.actions.backToHome}</Link>
          {checking && attempt >= 15 ? <button type="button" onClick={() => { setAttempt(0); void verify() }}>{t.chatApp.account.retry}</button> : null}
        </div>
      </div>
    </section>
  )
}
