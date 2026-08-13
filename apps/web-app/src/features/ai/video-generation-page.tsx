'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Coins, Download, LoaderCircle, RefreshCcw, UploadCloud, Video } from 'lucide-react'
import { config } from '@config'
import type { VideoGenerationResult } from '@vibechat/api-contracts'
import { ProductApiClient, ProductApiClientError } from '@vibechat/product-client'
import { useTranslation } from '@/hooks/use-translation'

type VideoProvider = keyof typeof config.aiVideo.availableModels
const videoApi = new ProductApiClient()

function sizesFor(provider: VideoProvider) {
  if (provider === 'fal') return config.aiVideo.falAspectRatios
  if (provider === 'volcengine') return config.aiVideo.volcengineSizes
  return config.aiVideo.aliyunSizes
}

export function VideoGenerationPage() {
  const { t } = useTranslation()
  const [provider, setProvider] = useState<VideoProvider>(config.aiVideo.defaultProvider)
  const [model, setModel] = useState<string>(config.aiVideo.defaultModels[config.aiVideo.defaultProvider])
  const [size, setSize] = useState<string>(sizesFor(config.aiVideo.defaultProvider)[0].value)
  const [duration, setDuration] = useState<number>(config.aiVideo.durationOptions[config.aiVideo.defaultProvider][0])
  const [prompt, setPrompt] = useState('')
  const [firstFrameUrl, setFirstFrameUrl] = useState('')
  const [result, setResult] = useState<VideoGenerationResult | null>(null)
  const [credits, setCredits] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [requestId, setRequestId] = useState<string | null>(null)
  const stopPolling = useRef(false)
  const sizeOptions = useMemo(() => sizesFor(provider), [provider])
  const loadCredits = useCallback(async () => {
    try { setCredits((await videoApi.getCreditStatus()).credits.balance) } catch { setCredits(null) }
  }, [])
  useEffect(() => { void loadCredits(); return () => { stopPolling.current = true } }, [loadCredits])

  const changeProvider = (next: VideoProvider) => {
    setProvider(next); setModel(config.aiVideo.defaultModels[next]); setSize(sizesFor(next)[0].value); setDuration(config.aiVideo.durationOptions[next][0])
  }
  const poll = async (taskId: string) => {
    const deadline = Date.now() + config.aiVideo.polling.maxTimeoutMs
    while (!stopPolling.current && Date.now() < deadline) {
      await new Promise((resolve) => window.setTimeout(resolve, config.aiVideo.polling.intervalMs))
      const status = await videoApi.getVideoTask(taskId)
      if (status.credits) setCredits(status.credits.remaining)
      if (status.data.status === 'succeeded' && status.data.result) { setResult(status.data.result); return }
      if (status.data.status === 'failed') throw new Error(status.data.error || t.ai.video.errors.generationFailed)
    }
    throw new Error(t.ai.video.errors.timeout)
  }
  const generate = async (event: React.FormEvent, retry = false) => {
    event.preventDefault()
    if (!prompt.trim() || loading) return
    const stableRequestId = retry && requestId ? requestId : `video:${crypto.randomUUID()}`
    setRequestId(stableRequestId); stopPolling.current = false; setLoading(true); setResult(null); setError('')
    try {
      const response = await videoApi.generateVideo({
        requestId: stableRequestId, prompt: prompt.trim(), provider, model, duration,
        ...(provider === 'fal' ? { aspectRatio: size } : { size }),
        firstFrameUrl: firstFrameUrl.trim() || undefined,
        promptExtend: provider === 'aliyun' ? true : undefined,
      })
      setCredits(response.credits.remaining)
      if ('videoUrl' in response.data) setResult(response.data)
      else await poll(response.data.taskId)
    } catch (cause) {
      setError(cause instanceof ProductApiClientError || cause instanceof Error ? cause.message : t.ai.video.errors.generationFailed)
      await loadCredits()
    } finally { setLoading(false) }
  }
  const uploadFrame = async (file?: File) => {
    if (!file) return
    setUploading(true); setError('')
    try { setFirstFrameUrl((await videoApi.uploadImage(file, 'r2')).url) }
    catch (cause) { setError(cause instanceof Error ? cause.message : t.ai.video.errors.uploadFailed) }
    finally { setUploading(false) }
  }

  return (
    <section className="vc-ai-page" data-testid="video-generation-page">
      <header className="vc-ai-header"><div><span className="vc-kicker">AI / VIDEO</span><h1>{t.ai.video.title}</h1><p>{t.ai.video.description}</p></div><div className="vc-ai-credit"><Coins size={15} /><span>{t.ai.video.credits}</span><strong>{credits ?? '—'}</strong></div></header>
      <div className="vc-generator-grid">
        <form className="vc-generation-form" onSubmit={(event) => void generate(event)}>
          <label><span>{t.ai.video.providers.title}</span><select value={provider} onChange={(event) => changeProvider(event.target.value as VideoProvider)} disabled={loading}>{(Object.keys(config.aiVideo.availableModels) as VideoProvider[]).map((value) => <option key={value} value={value}>{t.ai.video.providers[value]}</option>)}</select></label>
          <label><span>{t.ai.video.model}</span><select value={model} onChange={(event) => setModel(event.target.value)} disabled={loading}>{config.aiVideo.availableModels[provider].map((value) => <option key={value} value={value}>{t.ai.video.models[value]}</option>)}</select></label>
          <label><span>{t.ai.video.prompt}</span><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={t.ai.video.promptPlaceholder} maxLength={4000} rows={7} required /></label>
          <div className="vc-form-row"><label><span>{t.ai.video.settings.videoSize}</span><select value={size} onChange={(event) => setSize(event.target.value)}>{sizeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label><span>{t.ai.video.settings.duration}</span><select value={duration} onChange={(event) => setDuration(Number(event.target.value))}>{config.aiVideo.durationOptions[provider].map((value) => <option value={value} key={value}>{value}</option>)}</select></label></div>
          <label><span>{t.ai.video.frameInput.firstFrameUrl}</span><input type="url" value={firstFrameUrl} onChange={(event) => setFirstFrameUrl(event.target.value)} placeholder="https://" maxLength={2048} /></label>
          <label className="vc-frame-upload"><UploadCloud size={16} /><span>{uploading ? t.chatApp.services.uploading : t.ai.video.frameInput.upload}</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading || loading} onChange={(event) => void uploadFrame(event.target.files?.[0])} /></label>
          <button type="submit" disabled={loading || !prompt.trim()}>{loading ? <><LoaderCircle className="vc-spin" />{t.ai.video.generating}</> : <><Video size={16} />{t.ai.video.generate}</>}</button>
          {error ? <div className="vc-ai-error" role="alert"><span>{error}</span>{requestId ? <button type="button" onClick={(event) => void generate(event, true)}><RefreshCcw size={13} />{t.ai.chat.actions.retry}</button> : null}</div> : null}
        </form>
        <section className="vc-generation-result" data-state={loading ? 'loading' : result ? 'ready' : 'idle'}>
          {loading ? <div><LoaderCircle className="vc-spin" /><p>{t.ai.video.resultPanel.generatingHint}</p></div> : result ? <><video src={result.videoUrl} controls playsInline /><footer><span><strong>{result.provider}</strong>{result.model}</span><a href={result.videoUrl} target="_blank" rel="noreferrer"><Download size={15} />{t.ai.video.download}</a></footer></> : <div><Video size={42} /><h2>{t.ai.video.result}</h2><p>{t.ai.video.idle}</p></div>}
        </section>
      </div>
    </section>
  )
}
