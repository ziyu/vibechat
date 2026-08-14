'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { ArrowUp, Bot, Coins, LoaderCircle, RefreshCcw, Square, Trash2 } from 'lucide-react'
import { Streamdown } from 'streamdown'
import { config } from '@config'
import { ProductApiClient } from '@vibechat/product-client'
import { useTranslation } from '@/hooks/use-translation'

type ChatProvider = keyof typeof config.ai.availableModels
const aiApi = new ProductApiClient()

export function AiChatPage() {
  const { t } = useTranslation()
  const [provider, setProvider] = useState<ChatProvider>(config.ai.defaultProvider)
  const [model, setModel] = useState<string>(config.ai.defaultModels[config.ai.defaultProvider])
  const [input, setInput] = useState('')
  const [credits, setCredits] = useState<number | null>(null)
  const selectionRef = useRef({ provider, model })
  const endRef = useRef<HTMLDivElement>(null)
  selectionRef.current = { provider, model }

  const loadCredits = useCallback(async () => {
    try { setCredits((await aiApi.getCreditStatus()).credits.balance) } catch { setCredits(null) }
  }, [])
  useEffect(() => { void loadCredits() }, [loadCredits])

  const transport = useMemo(() => new DefaultChatTransport({
    api: '/api/chat',
    credentials: 'include',
    prepareSendMessagesRequest: ({ messages }) => ({
      body: {
        messages,
        provider: selectionRef.current.provider,
        model: selectionRef.current.model,
        requestId: `chat:${crypto.randomUUID()}`,
      },
    }),
  }), [])

  const { messages, sendMessage, status, error, stop, setMessages, clearError } = useChat({
    transport,
    onFinish: () => { void loadCredits() },
  })
  const busy = status === 'submitted' || status === 'streaming'
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, status])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const value = input.trim()
    if (!value || busy) return
    clearError()
    setInput('')
    await sendMessage({ text: value })
  }

  const changeProvider = (next: ChatProvider) => {
    setProvider(next)
    setModel(config.ai.defaultModels[next])
  }

  return (
    <section className="vc-ai-page vc-ai-chat-page" data-testid="ai-chat-page">
      <header className="vc-ai-header">
        <div><span className="vc-kicker">AI / CHAT</span><h1>{t.ai.chat.title}</h1><p>{t.ai.chat.description}</p></div>
        <div className="vc-ai-credit"><Coins size={15} /><span>{t.ai.video.credits}</span><strong>{credits ?? '—'}</strong></div>
      </header>
      <div className="vc-ai-toolbar">
        <label><span>{t.ai.chat.providers.title}</span><select value={provider} onChange={(event) => changeProvider(event.target.value as ChatProvider)} disabled={busy}>
          {(Object.keys(config.ai.availableModels) as ChatProvider[]).map((value) => <option value={value} key={value}>{t.ai.chat.providers[value]}</option>)}
        </select></label>
        <label><span>{t.ai.video.model}</span><select value={model} onChange={(event) => setModel(event.target.value)} disabled={busy}>
          {config.ai.availableModels[provider].map((value) => <option value={value} key={value}>{t.ai.chat.models[value]}</option>)}
        </select></label>
        <button type="button" className="vc-ai-icon-button" onClick={() => setMessages([])} disabled={busy || !messages.length} aria-label={t.ai.chat.actions.clearHistory}><Trash2 size={16} /></button>
      </div>
      <div className="vc-ai-conversation" aria-live="polite">
        {!messages.length ? <div className="vc-ai-empty"><Bot size={34} /><h2>{t.ai.chat.noMessages}</h2><p>{t.ai.chat.welcomeMessage}</p></div> : null}
        {messages.map((message) => {
          const text = message.parts.filter((part) => part.type === 'text').map((part) => part.text).join('')
          return <article key={message.id} className="vc-ai-message" data-role={message.role}>
            <small>{message.role === 'assistant' ? 'AI' : 'YOU'}</small>
            {message.role === 'assistant' ? <Streamdown isAnimating={busy}>{text}</Streamdown> : <p>{text}</p>}
          </article>
        })}
        {status === 'submitted' ? <p className="vc-ai-thinking"><LoaderCircle className="vc-spin" />{t.ai.chat.thinking}</p> : null}
        <div ref={endRef} />
      </div>
      {error ? <div className="vc-ai-error" role="alert"><span>{error.message || t.ai.chat.errors.failedToSend}</span><button type="button" onClick={() => clearError()}>{t.ai.chat.actions.dismiss}</button></div> : null}
      <form className="vc-ai-composer" onSubmit={submit}>
        <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder={t.ai.chat.placeholder} maxLength={12000} rows={3} onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() }
        }} />
        {busy ? <button type="button" onClick={stop} aria-label={t.ai.chat.actions.dismiss}><Square size={15} /></button>
          : <button type="submit" disabled={!input.trim()} aria-label={t.ai.chat.actions.send}><ArrowUp size={18} /></button>}
      </form>
      {status === 'error' ? <button type="button" className="vc-ai-inline-action" onClick={() => { clearError(); void loadCredits() }}><RefreshCcw size={14} />{t.ai.chat.actions.retry}</button> : null}
    </section>
  )
}
