'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Bot, Check, ExternalLink, ImageIcon, LoaderCircle, Sparkles, UploadCloud, Video } from 'lucide-react'
import type { PricingPlan } from '@vibechat/api-contracts'
import { ProductApiClient, ProductApiClientError } from '@vibechat/product-client'
import { useTranslation } from '@/hooks/use-translation'

const servicesApi = new ProductApiClient()
type StorageProvider = 'oss' | 's3' | 'r2' | 'cos'

export function ServicesPage() {
  const { t, locale } = useTranslation()
  const [plans, setPlans] = useState<PricingPlan[]>([])
  const [plansLoading, setPlansLoading] = useState(true)
  const [plansError, setPlansError] = useState(false)
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [storageProvider, setStorageProvider] = useState<StorageProvider>('r2')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadedUrl, setUploadedUrl] = useState('')
  const checkoutRequestIds = useRef(new Map<string, string>())

  const loadPlans = useCallback(async () => {
    setPlansLoading(true)
    setPlansError(false)
    try {
      setPlans((await servicesApi.getPricingPlans(locale)).plans)
    } catch {
      setPlansError(true)
    } finally {
      setPlansLoading(false)
    }
  }, [locale])

  useEffect(() => { void loadPlans() }, [loadPlans])
  useEffect(() => {
    if (!plans.length) {
      setSelectedPlanId(null)
      return
    }
    if (!selectedPlanId || !plans.some((plan) => plan.id === selectedPlanId)) {
      setSelectedPlanId(plans.find((plan) => plan.recommended)?.id || plans[0].id)
    }
  }, [plans, selectedPlanId])

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) || plans[0]
  const selectedLocalized = selectedPlan
    ? selectedPlan.i18n[locale] || selectedPlan.i18n.en || Object.values(selectedPlan.i18n)[0]
    : undefined
  const selectedFeatures = Array.isArray(selectedLocalized?.features)
    ? selectedLocalized.features
    : String(selectedLocalized?.features || '').split('\n').filter(Boolean)

  const handlePlanKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex = index
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % plans.length
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + plans.length) % plans.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = plans.length - 1
    else return

    event.preventDefault()
    setSelectedPlanId(plans[nextIndex].id)
    event.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [nextIndex]?.focus()
  }

  const startCheckout = async (plan: PricingPlan) => {
    setCheckoutPlan(plan.id)
    setCheckoutError('')
    const requestId = checkoutRequestIds.current.get(plan.id) || `payment:${crypto.randomUUID()}`
    checkoutRequestIds.current.set(plan.id, requestId)
    try {
      const result = await servicesApi.initiatePayment({
        planId: plan.id,
        provider: plan.provider,
        requestId,
      })
      window.location.assign(result.paymentUrl)
    } catch (error) {
      if (error instanceof ProductApiClientError) checkoutRequestIds.current.delete(plan.id)
      setCheckoutError(error instanceof ProductApiClientError ? error.message : t.chatApp.services.checkoutFailed)
      setCheckoutPlan(null)
    }
  }

  const upload = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!file) return
    setUploading(true)
    setUploadError('')
    setUploadedUrl('')
    try {
      const result = await servicesApi.uploadImage(file, storageProvider)
      setUploadedUrl(result.url)
    } catch (error) {
      setUploadError(error instanceof ProductApiClientError ? error.message : t.chatApp.services.uploadFailed)
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="vc-services-page" data-testid="services-page">
      <header className="vc-product-page-header">
        <div>
          <h1>{t.chatApp.services.title}</h1>
          <p>{t.chatApp.services.description}</p>
        </div>
        <Sparkles size={34} strokeWidth={1.3} />
      </header>

      <section className="vc-services-section" data-testid="pricing-plans">
        <header><div><h2>{t.chatApp.services.pricing}</h2></div><p>{t.chatApp.services.pricingDescription}</p></header>
        {plansLoading ? <p className="vc-inline-state"><LoaderCircle className="vc-spin" />{t.chatApp.services.loadingPlans}</p> : null}
        {plansError ? <p className="vc-inline-state" role="alert">{t.chatApp.services.plansFailed}<button type="button" onClick={() => void loadPlans()}>{t.chatApp.account.retry}</button></p> : null}
        {!plansLoading && !plansError && !plans.length ? <p className="vc-empty-record">{t.chatApp.services.noPlans}</p> : null}
        {plans.length ? (
          <div className="vc-service-counter">
            <div
              className="vc-plan-list"
              data-testid="service-plan-list"
              role="tablist"
              aria-label={t.chatApp.services.pricing}
            >
              {plans.map((plan, index) => {
                const localized = plan.i18n[locale] || plan.i18n.en || Object.values(plan.i18n)[0]
                const duration = plan.duration.type === 'credits'
                  ? t.chatApp.services.creditsPack.replace('{count}', String(plan.credits || 0))
                  : localized?.duration || plan.duration.type
                return (
                  <button
                    key={plan.id}
                    type="button"
                    id={`service-plan-${plan.id}`}
                    className="vc-plan-entry"
                    role="tab"
                    aria-controls="service-plan-detail"
                    aria-selected={selectedPlan?.id === plan.id}
                    tabIndex={selectedPlan?.id === plan.id ? 0 : -1}
                    data-active={selectedPlan?.id === plan.id || undefined}
                    data-recommended={plan.recommended || undefined}
                    onClick={() => setSelectedPlanId(plan.id)}
                    onKeyDown={(event) => handlePlanKeyDown(event, index)}
                  >
                    <span>
                      <strong>{localized?.name || plan.id}</strong>
                      <small>{localized?.description || ''}</small>
                    </span>
                    <span>
                      <strong><i>{plan.currency}</i>{plan.amount}</strong>
                      <small>{plan.provider} · {duration}</small>
                    </span>
                  </button>
                )
              })}
            </div>

            {selectedPlan ? (
              <aside
                className="vc-plan-threshold"
                id="service-plan-detail"
                role="tabpanel"
                aria-labelledby={`service-plan-${selectedPlan.id}`}
                tabIndex={0}
                data-testid="service-plan-detail"
              >
                <span className="vc-plan-lamp" aria-hidden="true" />
                <div>
                  <h3>{selectedLocalized?.name || selectedPlan.id}</h3>
                  <p>{selectedLocalized?.description || ''}</p>
                </div>
                <ul>
                  {selectedFeatures.map((feature) => (
                    <li key={feature}><Check size={14} />{feature.replace(/^[-*•]\s*/, '')}</li>
                  ))}
                </ul>
                <footer>
                  <span>
                    <strong><i>{selectedPlan.currency}</i>{selectedPlan.amount}</strong>
                    <small>{selectedPlan.provider} · {selectedPlan.duration.type === 'credits'
                      ? t.chatApp.services.creditsPack.replace('{count}', String(selectedPlan.credits || 0))
                      : selectedLocalized?.duration || selectedPlan.duration.type}</small>
                  </span>
                  <button type="button" onClick={() => void startCheckout(selectedPlan)} disabled={checkoutPlan !== null}>
                    {checkoutPlan === selectedPlan.id ? t.chatApp.services.openingCheckout : t.chatApp.services.buy.replace('{provider}', selectedPlan.provider)}
                  </button>
                </footer>
              </aside>
            ) : null}
          </div>
        ) : null}
        {checkoutError ? <p className="vc-form-error" role="alert">{checkoutError}</p> : null}
      </section>

      <section className="vc-services-duo">
        <section className="vc-services-section vc-upload-panel" data-testid="upload-panel">
          <header><div><h2>{t.chatApp.services.upload}</h2></div><p>{t.chatApp.services.uploadDescription}</p></header>
          <form onSubmit={upload}>
            <label className="vc-file-field">
              <UploadCloud size={23} />
              <span>{file?.name || t.chatApp.services.chooseFile}</span>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" required onChange={(event) => {
                const next = event.target.files?.[0] || null
                if (next && next.size > 10 * 1024 * 1024) {
                  setUploadError(t.chatApp.services.uploadFailed)
                  event.target.value = ''
                  setFile(null)
                  return
                }
                setFile(next)
                setUploadError('')
              }} />
            </label>
            <label><span>{t.chatApp.services.storageProvider}</span><select value={storageProvider} onChange={(event) => setStorageProvider(event.target.value as StorageProvider)}><option value="r2">Cloudflare R2</option><option value="s3">Amazon S3</option><option value="oss">Aliyun OSS</option><option value="cos">Tencent COS</option></select></label>
            <button type="submit" disabled={!file || uploading}>{uploading ? t.chatApp.services.uploading : t.chatApp.services.uploadNow}</button>
            {uploadError ? <p className="vc-form-error" role="alert">{uploadError}</p> : null}
            {uploadedUrl ? <a href={uploadedUrl} target="_blank" rel="noreferrer" className="vc-upload-result"><Check size={14} /><span>{t.chatApp.services.uploaded}</span><ExternalLink size={13} /></a> : null}
          </form>
        </section>

        <section className="vc-services-section vc-ai-launcher" data-testid="ai-tools">
          <header><div><h2>{t.chatApp.services.aiTools}</h2></div><p>{t.chatApp.services.aiDescription}</p></header>
          <div>
            <ToolLink href={`/${locale}/ai`} icon={<Bot />} label={t.chatApp.services.aiChat} action={t.chatApp.services.open} />
            <ToolLink href={`/${locale}/image-generate`} icon={<ImageIcon />} label={t.chatApp.services.aiImage} action={t.chatApp.services.open} />
            <ToolLink href={`/${locale}/video-generate`} icon={<Video />} label={t.chatApp.services.aiVideo} action={t.chatApp.services.open} />
          </div>
        </section>
      </section>
    </section>
  )
}

function ToolLink({ href, icon, label, action }: { href: string; icon: React.ReactNode; label: string; action: string }) {
  return <a href={href}><span>{icon}</span><strong>{label}</strong><small>{action}<ExternalLink size={11} /></small></a>
}
