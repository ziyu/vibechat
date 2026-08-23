'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppWindow, Bot, Code2, MessagesSquare, Radio, Rocket } from 'lucide-react'
import {
  spaceAppBridgeRequestSchema,
  type SpaceAppChannel,
  type SpaceRuntimeSnapshot,
} from '@vibechat/space-app-contracts'
import { ProductApiClient } from '@vibechat/product-client'
import { useTranslation } from '@/hooks/use-translation'

const productApi = new ProductApiClient()
const bridgeVersion = 1

export type SpaceRuntimeEvent = Record<string, unknown> & { type: string }

export function useSpaceRuntime(roomId: string) {
  const [snapshot, setSnapshot] = useState<SpaceRuntimeSnapshot | null>(null)
  const [runtimeEvent, setRuntimeEvent] = useState<SpaceRuntimeEvent | null>(null)
  const [channel, setChannel] = useState<SpaceAppChannel>('dev')
  const [unavailable, setUnavailable] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const mounted = useRef(true)

  const refresh = useCallback(async () => {
    try {
      const next = await productApi.getSpaceRuntime(roomId)
      if (!mounted.current) return
      setSnapshot(next)
      setUnavailable(false)
    } catch {
      if (mounted.current) setUnavailable(true)
    }
  }, [roomId])

  useEffect(() => {
    mounted.current = true
    setSnapshot(null)
    setRuntimeEvent(null)
    setChannel('dev')
    void refresh()
    const timer = window.setInterval(() => void refresh(), 1_500)
    const events = new EventSource(productApi.spaceEventsUrl(roomId), { withCredentials: true })
    events.onmessage = (event) => {
      try {
        const value = JSON.parse(event.data) as SpaceRuntimeEvent
        if (!value || typeof value.type !== 'string') return
        setRuntimeEvent(value)
        if (['draft_ready', 'deployed', 'turn_failed', 'chat_completed'].includes(value.type)) {
          void refresh()
        }
      } catch {
        // Ignore malformed runtime events; the authenticated snapshot poll remains authoritative.
      }
    }
    return () => {
      mounted.current = false
      events.close()
      window.clearInterval(timer)
    }
  }, [refresh, roomId])

  const publish = useCallback(async () => {
    setPublishing(true)
    try {
      await productApi.publishSpaceApp(roomId, { requestId: globalThis.crypto.randomUUID() })
      await refresh()
      setChannel('live')
    } finally {
      if (mounted.current) setPublishing(false)
    }
  }, [refresh, roomId])

  const appUrl = useMemo(() => {
    if (!snapshot?.project.exists) return null
    if (channel === 'dev' && !snapshot.project.draftId) return null
    if (channel === 'live' && !snapshot.project.releaseId) return null
    const version = channel === 'dev' ? snapshot.project.draftId : snapshot.project.releaseId
    return `${productApi.spaceAppUrl(roomId, channel)}&version=${encodeURIComponent(version || '')}`
  }, [channel, roomId, snapshot])

  return {
    snapshot,
    runtimeEvent,
    channel,
    setChannel,
    unavailable,
    publishing,
    publish,
    refresh,
    appUrl,
  }
}

interface SpaceSurfaceMember {
  id: string
  name: string
}

export function SpaceAppSurface({
  roomId,
  appUrl,
  channel,
  snapshot,
  runtimeEvent,
  self,
  members,
  onChatSend,
  onTheme,
}: {
  roomId: string
  appUrl: string | null
  channel: SpaceAppChannel
  snapshot: SpaceRuntimeSnapshot | null
  runtimeEvent: SpaceRuntimeEvent | null
  self: SpaceSurfaceMember
  members: SpaceSurfaceMember[]
  onChatSend: (text: string) => Promise<unknown>
  onTheme: (theme: Record<string, string>) => void
}) {
  const { t } = useTranslation()
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const hostSnapshot = useMemo(() => ({
    appId: snapshot?.spaceInstanceId || '',
    self: { id: self.id, clientId: self.id, name: self.name },
    members: members.map((member) => ({
      id: member.id,
      clientId: member.id,
      name: member.name,
    })),
    messages: snapshot?.messages || [],
    app: {
      revision: snapshot?.appState.revision || 0,
      state: snapshot?.appState.state || {},
      presence: snapshot?.appState.presence || [],
    },
    agent: {
      id: snapshot?.defaultAgentId || 'pi',
      name: snapshot?.availableAgents.find((agent) => agent.id === snapshot.defaultAgentId)?.name || 'Pi',
      build: snapshot?.build || null,
      queue: snapshot?.queue || { activeCount: 0, pendingCount: 0 },
    },
  }), [members, self.id, self.name, snapshot])

  const postToApp = useCallback((value: unknown) => {
    iframeRef.current?.contentWindow?.postMessage(value, '*')
  }, [])

  const initializeApp = useCallback(() => {
    postToApp({ type: 'space:init', version: bridgeVersion, snapshot: hostSnapshot })
  }, [hostSnapshot, postToApp])

  useEffect(() => {
    initializeApp()
  }, [initializeApp])

  useEffect(() => {
    if (!runtimeEvent) return
    postToApp({ type: 'space:event', version: bridgeVersion, event: runtimeEvent })
  }, [postToApp, runtimeEvent])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow || !event.data || typeof event.data !== 'object') {
        return
      }
      const data = event.data as Record<string, unknown>
      if (data.type === 'space:bridge-ready' && data.version === bridgeVersion) {
        initializeApp()
        return
      }
      if (data.type === 'space:theme') {
        onTheme(normalizeTheme(data.theme))
        return
      }
      if (data.type !== 'space:command' || data.version !== bridgeVersion || typeof data.id !== 'string') {
        return
      }

      const parsed = spaceAppBridgeRequestSchema.safeParse({
        action: data.action,
        payload: data.payload,
      })
      if (!parsed.success) {
        postToApp({ type: 'space:result', id: data.id, ok: false, error: 'Invalid Space command' })
        return
      }

      void (async () => {
        try {
          let result: unknown
          if (parsed.data.action === 'chat.send') {
            const text = parsed.data.payload.text
            if (typeof text !== 'string' || !text.trim() || text.length > 4_000) {
              throw new Error('Chat message is invalid')
            }
            result = await onChatSend(text.trim())
          } else if (parsed.data.action === 'theme.set') {
            throw new Error('Theme commands must use space.theme.set')
          } else {
            result = await productApi.sendSpaceAppCommand(roomId, parsed.data)
          }
          postToApp({ type: 'space:result', id: data.id, ok: true, result })
        } catch (error) {
          postToApp({
            type: 'space:result',
            id: data.id,
            ok: false,
            error: error instanceof Error ? error.message : 'Space command failed',
          })
        }
      })()
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [initializeApp, onChatSend, onTheme, postToApp, roomId])

  if (!appUrl) return <div className="vc-space-app-empty" aria-hidden="true" />
  return (
    <div className="vc-space-app-surface" data-channel={channel} data-testid="space-app-surface">
      <iframe
        ref={iframeRef}
        key={appUrl}
        src={appUrl}
        title={t.chatApp.spaceRuntime.appTitle}
        sandbox="allow-scripts allow-forms allow-popups"
        referrerPolicy="no-referrer"
        onLoad={initializeApp}
      />
    </div>
  )
}

export function SpaceKernelControls({
  runtime,
  appFocused,
  onAppFocusedChange,
}: {
  runtime: ReturnType<typeof useSpaceRuntime>
  appFocused: boolean
  onAppFocusedChange: (focused: boolean) => void
}) {
  const { t } = useTranslation()
  const { snapshot, channel, setChannel, unavailable, publishing, publish } = runtime
  const building = Boolean(snapshot?.build)
  return (
    <div className="vc-space-kernel" data-testid="space-kernel">
      <button
        type="button"
        className="vc-space-focus"
        disabled={!runtime.appUrl}
        onClick={() => onAppFocusedChange(!appFocused)}
        aria-pressed={appFocused}
        title={appFocused ? t.chatApp.spaceRuntime.focusChat : t.chatApp.spaceRuntime.focusApp}
      >
        {appFocused ? <MessagesSquare size={13} /> : <AppWindow size={13} />}
        {appFocused ? t.chatApp.spaceRuntime.chat : t.chatApp.spaceRuntime.app}
      </button>
      <span className="vc-space-agent-chip" data-active={building || undefined}>
        <Bot size={13} />
        {snapshot?.defaultAgentId || 'pi'}
        {building ? <i /> : null}
      </span>
      <span className="vc-space-channel-switch" aria-label={t.chatApp.spaceRuntime.channelLabel}>
        <button type="button" data-active={channel === 'dev' || undefined} onClick={() => setChannel('dev')}>
          <Code2 size={12} /> {t.chatApp.spaceRuntime.dev}
        </button>
        <button
          type="button"
          data-active={channel === 'live' || undefined}
          disabled={!snapshot?.project.releaseId}
          onClick={() => setChannel('live')}
        >
          <Radio size={12} /> {t.chatApp.spaceRuntime.live}
        </button>
      </span>
      <button
        type="button"
        className="vc-space-publish"
        disabled={!snapshot?.project.draftId || publishing || unavailable}
        onClick={() => void publish().catch(() => undefined)}
      >
        <Rocket size={13} />
        {publishing ? t.chatApp.spaceRuntime.publishing : t.chatApp.spaceRuntime.publish}
      </button>
    </div>
  )
}

function normalizeTheme(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const allowed = new Set([
    'text',
    'muted',
    'accent',
    'surface',
    'surfaceStrong',
    'border',
    'own',
    'peer',
    'agent',
    'radius',
  ])
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, item]) => allowed.has(key) && typeof item === 'string')
      .map(([key, item]) => [key, String(item).slice(0, 80)]),
  )
}
