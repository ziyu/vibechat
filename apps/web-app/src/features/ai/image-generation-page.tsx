'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Coins, Download, ImageIcon, LoaderCircle, RefreshCcw, Sparkles } from 'lucide-react'
import { config } from '@config'
import type { ImageGenerationResult } from '@vibechat/api-contracts'
import { ProductApiClient, ProductApiClientError } from '@vibechat/product-client'
import { useTranslation } from '@/hooks/use-translation'

type ImageProvider = keyof typeof config.aiImage.availableModels
const imageApi = new ProductApiClient()

function sizesFor(provider: ImageProvider) {
  if (provider === 'qwen') return config.aiImage.qwenSizes
  if (provider === 'fal') return config.aiImage.falAspectRatios
  if (provider === 'openai') return config.aiImage.openaiSizes
  return config.aiImage.geminiAspectRatios
}

export function ImageGenerationPage() {
  const { t } = useTranslation()
  const [provider, setProvider] = useState<ImageProvider>(config.aiImage.defaultProvider)
  const [model, setModel] = useState<string>(config.aiImage.defaultModels[config.aiImage.defaultProvider])
  const [size, setSize] = useState<string>(sizesFor(config.aiImage.defaultProvider)[0].value)
  const [prompt, setPrompt] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [result, setResult] = useState<ImageGenerationResult | null>(null)
  const [credits, setCredits] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [requestId, setRequestId] = useState<string | null>(null)
  const sizeOptions = useMemo(() => sizesFor(provider), [provider])
  const loadCredits = useCallback(async () => {
    try { setCredits((await imageApi.getCreditStatus()).credits.balance) } catch { setCredits(null) }
  }, [])
  useEffect(() => { void loadCredits() }, [loadCredits])

  const changeProvider = (next: ImageProvider) => {
    setProvider(next)
    setModel(config.aiImage.defaultModels[next])
    setSize(sizesFor(next)[0].value)
  }
  const generate = async (event: React.FormEvent, retry = false) => {
    event.preventDefault()
    if (!prompt.trim() || loading) return
    const stableRequestId = retry && requestId ? requestId : `image:${crypto.randomUUID()}`
    setRequestId(stableRequestId)
    setLoading(true); setError(''); setResult(null)
    try {
      const response = await imageApi.generateImage({
        requestId: stableRequestId,
        prompt: prompt.trim(), provider, model,
        negativePrompt: negativePrompt.trim() || undefined,
        ...(provider === 'fal' || provider === 'gemini' ? { aspectRatio: size } : { size }),
        promptExtend: provider === 'qwen' ? true : undefined,
      })
      setResult(response.data)
      setCredits(response.credits.remaining)
    } catch (cause) {
      setError(cause instanceof ProductApiClientError ? cause.message : t.ai.image.errors.generationFailed)
      await loadCredits()
    } finally { setLoading(false) }
  }

  return (
    <section className="vc-ai-page" data-testid="image-generation-page">
      <header className="vc-ai-header"><div><span className="vc-kicker">AI / IMAGE</span><h1>{t.ai.image.title}</h1><p>{t.ai.image.description}</p></div><div className="vc-ai-credit"><Coins size={15} /><span>{t.ai.image.credits}</span><strong>{credits ?? '—'}</strong></div></header>
      <div className="vc-generator-grid">
        <form className="vc-generation-form" onSubmit={(event) => void generate(event)}>
          <label><span>{t.ai.image.providers.title}</span><select value={provider} onChange={(event) => changeProvider(event.target.value as ImageProvider)} disabled={loading}>{(Object.keys(config.aiImage.availableModels) as ImageProvider[]).map((value) => <option key={value} value={value}>{t.ai.image.providers[value]}</option>)}</select></label>
          <label><span>{t.ai.video.model}</span><select value={model} onChange={(event) => setModel(event.target.value)} disabled={loading}>{config.aiImage.availableModels[provider].map((value) => <option key={value} value={value}>{t.ai.image.models[value]}</option>)}</select></label>
          <label><span>{t.ai.image.prompt}</span><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={t.ai.image.promptPlaceholder} maxLength={4000} rows={7} required /></label>
          <label><span>{t.ai.image.negativePrompt}</span><textarea value={negativePrompt} onChange={(event) => setNegativePrompt(event.target.value)} placeholder={t.ai.image.negativePromptPlaceholder} maxLength={2000} rows={3} /></label>
          <label><span>{t.ai.image.settings.imageSize}</span><select value={size} onChange={(event) => setSize(event.target.value)}>{sizeOptions.map((option) => <option key={option.value} value={option.value}>{option.label} · {option.value}</option>)}</select></label>
          <button type="submit" disabled={loading || !prompt.trim()}>{loading ? <><LoaderCircle className="vc-spin" />{t.ai.image.generating}</> : <><Sparkles size={16} />{t.ai.image.generate}</>}</button>
          {error ? <div className="vc-ai-error" role="alert"><span>{error}</span>{requestId ? <button type="button" onClick={(event) => void generate(event, true)}><RefreshCcw size={13} />{t.ai.chat.actions.retry}</button> : null}</div> : null}
        </form>
        <section className="vc-generation-result" data-state={loading ? 'loading' : result ? 'ready' : 'idle'}>
          {loading ? <div><LoaderCircle className="vc-spin" /><p>{t.ai.image.generating}</p></div> : result ? <><img src={result.imageUrl} alt={prompt} /><footer><span><strong>{result.provider}</strong>{result.model}</span><a href={result.imageUrl} target="_blank" rel="noreferrer"><Download size={15} />{t.ai.image.download}</a></footer></> : <div><ImageIcon size={42} /><h2>{t.ai.image.preview}</h2><p>{t.ai.image.idle}</p></div>}
        </section>
      </div>
    </section>
  )
}
