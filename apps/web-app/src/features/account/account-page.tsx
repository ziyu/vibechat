'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  BadgeDollarSign,
  Coins,
  Copy,
  CreditCard,
  ExternalLink,
  Gift,
  History,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  Users,
  WalletCards,
} from 'lucide-react'
import type {
  AffiliateStatsResponse,
  CommissionsResponse,
  CreditStatusResponse,
  CreditTransactionsResponse,
  OrdersResponse,
  ReferralsResponse,
  SubscriptionStatusResponse,
  WithdrawalsResponse,
} from '@vibechat/api-contracts'
import { ProductApiClient, ProductApiClientError } from '@vibechat/product-client'
import { useTranslation } from '@/hooks/use-translation'
import { AccountSecurityPanel } from './account-security-panel'

const accountApi = new ProductApiClient()
type AccountTab = 'overview' | 'credits' | 'orders' | 'affiliate' | 'security'

interface CoreAccountData {
  creditStatus: CreditStatusResponse
  transactions: CreditTransactionsResponse
  orders: OrdersResponse
  subscription: SubscriptionStatusResponse
}

interface AffiliateData {
  stats: AffiliateStatsResponse
  commissions: CommissionsResponse
  referrals: ReferralsResponse
  withdrawals: WithdrawalsResponse
}

export function AccountPage() {
  const { t, locale } = useTranslation()
  const [activeTab, setActiveTab] = useState<AccountTab>('overview')
  const [core, setCore] = useState<CoreAccountData | null>(null)
  const [affiliate, setAffiliate] = useState<AffiliateData | null>(null)
  const [coreError, setCoreError] = useState(false)
  const [affiliateError, setAffiliateError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [withdrawalForm, setWithdrawalForm] = useState({ amount: '', paymentMethod: 'alipay', paymentAccount: '' })
  const [withdrawalState, setWithdrawalState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [withdrawalError, setWithdrawalError] = useState('')

  const loadAffiliate = useCallback(async () => {
    setAffiliateError(false)
    try {
      const stats = await accountApi.getAffiliateStats()
      if (!stats.enabled) {
        setAffiliate({
          stats,
          commissions: { commissions: [], total: 0, page: 1, pageSize: 10, totalPages: 0 },
          referrals: { referrals: [], total: 0, page: 1, pageSize: 10, totalPages: 0 },
          withdrawals: { withdrawals: [], total: 0, page: 1, pageSize: 10, totalPages: 0 },
        })
        return
      }
      const [commissions, referrals, withdrawals] = await Promise.all([
        accountApi.getCommissions(),
        accountApi.getReferrals(),
        accountApi.getWithdrawals(),
      ])
      setAffiliate({ stats, commissions, referrals, withdrawals })
    } catch {
      setAffiliateError(true)
    }
  }, [])

  const loadAccount = useCallback(async () => {
    setLoading(true)
    setCoreError(false)
    const coreResult = await Promise.allSettled([
      accountApi.getCreditStatus(),
      accountApi.getCreditTransactions(),
      accountApi.getOrders(),
      accountApi.getSubscriptionStatus(),
    ])
    if (coreResult.every((result) => result.status === 'fulfilled')) {
      const [creditStatus, transactions, orders, subscription] = coreResult.map((result) => (
        result as PromiseFulfilledResult<unknown>
      ).value) as [CreditStatusResponse, CreditTransactionsResponse, OrdersResponse, SubscriptionStatusResponse]
      setCore({ creditStatus, transactions, orders, subscription })
    } else {
      setCoreError(true)
    }
    await loadAffiliate()
    setLoading(false)
  }, [loadAffiliate])

  useEffect(() => { void loadAccount() }, [loadAccount])

  const formatDate = (value: string | Date) => new Date(value).toLocaleString(locale === 'zh-CN' ? 'zh-CN' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  const money = (value: string | number, currency: string) => new Intl.NumberFormat(locale === 'zh-CN' ? 'zh-CN' : 'en-US', {
    style: 'currency', currency,
  }).format(Number(value))

  const manageSubscription = async () => {
    setPortalLoading(true)
    try {
      const result = await accountApi.createSubscriptionPortal(undefined, `${window.location.origin}/${locale}/account`)
      window.location.assign(result.url)
    } finally {
      setPortalLoading(false)
    }
  }

  const submitWithdrawal = async (event: React.FormEvent) => {
    event.preventDefault()
    setWithdrawalState('submitting')
    setWithdrawalError('')
    try {
      await accountApi.requestWithdrawal({
        amount: Number(withdrawalForm.amount),
        paymentMethod: withdrawalForm.paymentMethod as 'alipay' | 'paypal' | 'bank_transfer',
        paymentAccount: withdrawalForm.paymentAccount,
        requestId: `withdrawal:${crypto.randomUUID()}`,
      })
      setWithdrawalForm((current) => ({ ...current, amount: '', paymentAccount: '' }))
      setWithdrawalState('success')
      await loadAffiliate()
    } catch (error) {
      setWithdrawalError(error instanceof ProductApiClientError ? error.message : t.chatApp.account.withdrawalFailed)
      setWithdrawalState('error')
    }
  }

  const tabs = useMemo(() => [
    ['overview', t.chatApp.account.tabs.overview, WalletCards],
    ['credits', t.chatApp.account.tabs.credits, Coins],
    ['orders', t.chatApp.account.tabs.orders, ReceiptText],
    ['affiliate', t.chatApp.account.tabs.affiliate, Users],
    ['security', t.chatApp.account.tabs.security, ShieldCheck],
  ] as const, [t])

  return (
    <section className="vc-account-page" data-testid="account-page">
      <header className="vc-product-page-header">
        <div>
          <span className="vc-kicker">{t.chatApp.account.kicker}</span>
          <h1>{t.chatApp.account.title}</h1>
          <p>{t.chatApp.account.description}</p>
        </div>
        <Link to="/services" className="vc-product-cta">
          {t.chatApp.services.pricing}<ExternalLink size={14} />
        </Link>
      </header>

      <nav className="vc-product-tabs" aria-label={t.chatApp.account.title}>
        {tabs.map(([id, label, Icon]) => (
          <button key={id} type="button" data-active={activeTab === id || undefined} onClick={() => setActiveTab(id)}>
            <Icon size={15} />{label}
          </button>
        ))}
      </nav>

      {loading ? <AccountState icon={<RefreshCcw className="vc-spin" />} text={t.chatApp.account.loading} /> : null}
      {!loading && coreError ? (
        <AccountState icon={<RefreshCcw />} text={t.chatApp.account.loadFailed}>
          <button type="button" onClick={() => void loadAccount()}>{t.chatApp.account.retry}</button>
        </AccountState>
      ) : null}

      {!loading && core && activeTab === 'overview' ? (
        <div className="vc-account-overview" data-testid="account-overview">
          <MetricCard icon={<CreditCard />} label={t.chatApp.account.subscription} value={
            core.subscription.isLifetime ? t.chatApp.account.lifetime
              : core.subscription.hasSubscription ? t.chatApp.account.activePlan
                : t.chatApp.account.noSubscription
          }>
            {core.subscription.hasSubscription && !core.subscription.isLifetime ? (
              <button type="button" onClick={() => void manageSubscription()} disabled={portalLoading}>
                {t.chatApp.account.manageSubscription}
              </button>
            ) : null}
          </MetricCard>
          <MetricCard icon={<Coins />} label={t.chatApp.account.availableCredits} value={String(core.creditStatus.credits.balance)}>
            <span>{t.chatApp.account.purchased} {core.creditStatus.credits.totalPurchased} · {t.chatApp.account.consumed} {core.creditStatus.credits.totalConsumed}</span>
          </MetricCard>
          <MetricCard icon={<History />} label={t.chatApp.account.orders} value={String(core.orders.total)}>
            <button type="button" onClick={() => setActiveTab('orders')}>{t.chatApp.common.viewAll}</button>
          </MetricCard>
          <MetricCard icon={<BadgeDollarSign />} label={t.chatApp.account.commissionBalance} value={affiliate ? `${affiliate.stats.commissionBalance} ${affiliate.stats.currency}` : '—'}>
            <button type="button" onClick={() => setActiveTab('affiliate')}>{t.chatApp.common.viewAll}</button>
          </MetricCard>
          <section className="vc-ledger-card vc-overview-ledger">
            <header><Coins size={17} /><h2>{t.chatApp.account.recentActivity}</h2></header>
            <LedgerRows rows={core.transactions.transactions.slice(0, 5)} empty={t.chatApp.account.noTransactions} formatDate={formatDate} />
          </section>
        </div>
      ) : null}

      {!loading && core && activeTab === 'credits' ? (
        <section className="vc-ledger-card" data-testid="credit-ledger">
          <header><Coins size={17} /><h2>{t.chatApp.account.credits}</h2><strong>{core.creditStatus.credits.balance}</strong></header>
          <LedgerRows rows={core.transactions.transactions} empty={t.chatApp.account.noTransactions} formatDate={formatDate} />
        </section>
      ) : null}

      {!loading && core && activeTab === 'orders' ? (
        <section className="vc-ledger-card" data-testid="order-ledger">
          <header><ReceiptText size={17} /><h2>{t.chatApp.account.orders}</h2><strong>{core.orders.total}</strong></header>
          {core.orders.orders.length ? (
            <div className="vc-record-table">
              {core.orders.orders.map((order) => (
                <article key={order.id}>
                  <span><strong>{order.planId}</strong><small>{order.id}</small></span>
                  <span><strong>{money(order.amount, order.currency)}</strong><small>{order.provider}</small></span>
                  <i data-status={order.status}>{order.status}</i>
                  <time>{formatDate(order.createdAt)}</time>
                </article>
              ))}
            </div>
          ) : <p className="vc-empty-record">{t.chatApp.account.noOrders}</p>}
        </section>
      ) : null}

      {!loading && activeTab === 'affiliate' ? (
        affiliateError || !affiliate ? (
          <AccountState icon={<Gift />} text={t.chatApp.account.affiliateUnavailable}>
            <button type="button" onClick={() => void loadAffiliate()}>{t.chatApp.account.retry}</button>
          </AccountState>
        ) : !affiliate.stats.enabled ? (
          <AccountState icon={<Gift />} text={t.chatApp.account.affiliateDisabled} />
        ) : (
          <div className="vc-affiliate-grid" data-testid="affiliate-account">
            <section className="vc-referral-hero">
              <span>{t.chatApp.account.referralLink}</span>
              <strong>{affiliate.stats.referralLink}</strong>
              <button type="button" onClick={() => {
                void navigator.clipboard.writeText(affiliate.stats.referralLink)
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1600)
              }}><Copy size={13} />{copied ? t.chatApp.account.copied : t.chatApp.account.copy}</button>
              <div>
                <span><b>{affiliate.stats.commissionBalance} {affiliate.stats.currency}</b><small>{t.chatApp.account.commissionBalance}</small></span>
                <span><b>{affiliate.stats.totalRegisteredReferrals}</b><small>{t.chatApp.account.registeredReferrals}</small></span>
                <span><b>{affiliate.stats.totalPaidReferrals}</b><small>{t.chatApp.account.paidReferrals}</small></span>
              </div>
            </section>
            <section className="vc-ledger-card">
              <header><BadgeDollarSign size={17} /><h2>{t.chatApp.account.commissions}</h2></header>
              {affiliate.commissions.commissions.length ? affiliate.commissions.commissions.map((entry) => (
                <article className="vc-simple-record" key={entry.id}>
                  <span><strong>{entry.buyer?.name || entry.buyer?.email || entry.buyerId}</strong><small>{formatDate(entry.createdAt)}</small></span>
                  <b>+{entry.commissionAmount} {entry.currency}</b>
                </article>
              )) : <p className="vc-empty-record">{t.chatApp.account.noCommissions}</p>}
            </section>
            <section className="vc-ledger-card">
              <header><Users size={17} /><h2>{t.chatApp.account.referrals}</h2></header>
              {affiliate.referrals.referrals.length ? affiliate.referrals.referrals.map((entry) => (
                <article className="vc-simple-record" key={entry.id}>
                  <span><strong>{entry.name || entry.email}</strong><small>{entry.email}</small></span>
                  <time>{formatDate(entry.createdAt)}</time>
                </article>
              )) : <p className="vc-empty-record">{t.chatApp.account.noReferrals}</p>}
            </section>
            <section className="vc-ledger-card vc-withdrawal-card">
              <header><WalletCards size={17} /><h2>{t.chatApp.account.withdrawal}</h2></header>
              <form onSubmit={submitWithdrawal}>
                <label><span>{t.chatApp.account.withdrawalAmount}</span><input type="number" min={affiliate.stats.minWithdrawalAmount} step="0.01" value={withdrawalForm.amount} required onChange={(event) => setWithdrawalForm({ ...withdrawalForm, amount: event.target.value })} /></label>
                <label><span>{t.chatApp.account.withdrawalMethod}</span><select value={withdrawalForm.paymentMethod} onChange={(event) => setWithdrawalForm({ ...withdrawalForm, paymentMethod: event.target.value })}><option value="alipay">{t.chatApp.account.paymentMethods.alipay}</option><option value="paypal">{t.chatApp.account.paymentMethods.paypal}</option><option value="bank_transfer">{t.chatApp.account.paymentMethods.bankTransfer}</option></select></label>
                <label><span>{t.chatApp.account.withdrawalAccount}</span><input maxLength={200} value={withdrawalForm.paymentAccount} required onChange={(event) => setWithdrawalForm({ ...withdrawalForm, paymentAccount: event.target.value })} /></label>
                <small>{t.chatApp.account.minWithdrawal.replace('{amount}', String(affiliate.stats.minWithdrawalAmount)).replace('{currency}', affiliate.stats.currency)}</small>
                {withdrawalState === 'success' ? <p role="status">{t.chatApp.account.withdrawalSuccess}</p> : null}
                {withdrawalState === 'error' ? <p role="alert">{withdrawalError || t.chatApp.account.withdrawalFailed}</p> : null}
                <button type="submit" disabled={withdrawalState === 'submitting'}>{withdrawalState === 'submitting' ? t.chatApp.account.submittingWithdrawal : t.chatApp.account.submitWithdrawal}</button>
              </form>
            </section>
            <section className="vc-ledger-card">
              <header><History size={17} /><h2>{t.chatApp.account.withdrawalHistory}</h2></header>
              {affiliate.withdrawals.withdrawals.length ? affiliate.withdrawals.withdrawals.map((entry) => (
                <article className="vc-simple-record" key={entry.id}>
                  <span><strong>{entry.amount} {entry.currency}</strong><small>{entry.paymentMethod} · {entry.paymentAccount}</small></span>
                  <i data-status={entry.status}>{entry.status}</i>
                </article>
              )) : <p className="vc-empty-record">{t.chatApp.account.noWithdrawals}</p>}
            </section>
          </div>
        )
      ) : null}

      {!loading && core && activeTab === 'security' ? (
        <AccountSecurityPanel hasActiveSubscription={core.subscription.hasSubscription && !core.subscription.isLifetime} />
      ) : null}
    </section>
  )
}

function AccountState({ icon, text, children }: { icon: React.ReactNode; text: string; children?: React.ReactNode }) {
  return <section className="vc-account-state">{icon}<p>{text}</p>{children}</section>
}

function MetricCard({ icon, label, value, children }: { icon: React.ReactNode; label: string; value: string; children?: React.ReactNode }) {
  return <article className="vc-metric-card"><span>{icon}</span><small>{label}</small><strong>{value}</strong><div>{children}</div></article>
}

function LedgerRows({ rows, empty, formatDate }: { rows: CreditTransactionsResponse['transactions']; empty: string; formatDate: (value: string | Date) => string }) {
  if (!rows.length) return <p className="vc-empty-record">{empty}</p>
  return <div className="vc-ledger-rows">{rows.map((entry) => {
    const amount = Number(entry.amount)
    return <article key={entry.id}><span data-positive={amount > 0 || undefined}>{amount > 0 ? '+' : ''}{amount}</span><div><strong>{entry.description || entry.type}</strong><small>{entry.type} · {formatDate(entry.createdAt)}</small></div><b>{entry.balance}</b></article>
  })}</div>
}
