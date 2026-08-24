'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bot, CircleCheck, LoaderCircle, RefreshCw, Rocket } from 'lucide-react'
import {
  spaceAppBridgeRequestSchema,
  type SpaceAppBridgeRequest,
  type SpaceRuntimeSnapshot,
} from '@vibechat/space-app-contracts'
import type { ChatMessage } from '@vibechat/product-core'
import { ProductApiClient } from '@vibechat/product-client'
import { useTranslation } from '@/hooks/use-translation'
import {
  selectAgentConversationMessages,
  selectReadySpaceAppTarget,
  shouldProjectRuntimeEventToApp,
  type ReadySpaceAppTarget,
} from './space-runtime-state'

const productApi = new ProductApiClient()
const bridgeVersion = 1

export type SpaceRuntimeEvent = Record<string, unknown> & { type: string }

export function useSpaceRuntime(roomId: string) {
  const [snapshot, setSnapshot] = useState<SpaceRuntimeSnapshot | null>(null)
  const [runtimeEvent, setRuntimeEvent] = useState<SpaceRuntimeEvent | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoreError, setRestoreError] = useState(false)
  const [readyAppTarget, setReadyAppTarget] = useState<ReadySpaceAppTarget | null>(null)
  const mounted = useRef(true)
  const activeRoomId = useRef(roomId)

  const refresh = useCallback(async () => {
    try {
      const next = await productApi.getSpaceRuntime(roomId)
      if (!mounted.current || activeRoomId.current !== roomId) return
      setSnapshot(next)
      setUnavailable(false)
    } catch {
      if (mounted.current && activeRoomId.current === roomId) setUnavailable(true)
    }
  }, [roomId])

  useEffect(() => {
    mounted.current = true
    activeRoomId.current = roomId
    setSnapshot(null)
    setRuntimeEvent(null)
    setUnavailable(false)
    setRestoring(false)
    setRestoreError(false)
    void refresh()
    const timer = window.setInterval(() => void refresh(), 1_500)
    const events = new EventSource(productApi.spaceEventsUrl(roomId), { withCredentials: true })
    events.onmessage = (event) => {
      try {
        const value = JSON.parse(event.data) as SpaceRuntimeEvent
        if (!value || typeof value.type !== 'string') return
        setRuntimeEvent(value)
        if (['dev_ready', 'draft_ready', 'deployed', 'turn_failed', 'chat_completed'].includes(value.type)) {
          void refresh()
        }
      } catch {
        // The authenticated snapshot poll remains authoritative.
      }
    }
    return () => {
      mounted.current = false
      events.close()
      window.clearInterval(timer)
    }
  }, [refresh, roomId])

  const baseAppUrl = useMemo(() => productApi.spaceAppUrl(roomId, 'dev'), [roomId])

  useEffect(() => {
    setReadyAppTarget((previous) => selectReadySpaceAppTarget({
      roomId,
      snapshot,
      previous,
      baseUrl: baseAppUrl,
    }))
  }, [baseAppUrl, roomId, snapshot])

  const publish = useCallback(async () => {
    setPublishing(true)
    try {
      await productApi.publishSpaceApp(roomId, { requestId: globalThis.crypto.randomUUID() })
      await refresh()
    } finally {
      if (mounted.current) setPublishing(false)
    }
  }, [refresh, roomId])

  const restoreDefaultChat = useCallback(async () => {
    const expectedReadyRevisionId = snapshot?.project.draftId
    if (!expectedReadyRevisionId) throw new Error('SPACE_READY_REVISION_REQUIRED')
    setRestoring(true)
    setRestoreError(false)
    try {
      await productApi.restoreSpaceApp(roomId, {
        requestId: globalThis.crypto.randomUUID(),
        target: 'default-chat',
        expectedReadyRevisionId,
      })
      await refresh()
    } catch (error) {
      if (mounted.current && activeRoomId.current === roomId) setRestoreError(true)
      throw error
    } finally {
      if (mounted.current && activeRoomId.current === roomId) setRestoring(false)
    }
  }, [refresh, roomId, snapshot?.project.draftId])

  const appUrl = readyAppTarget?.roomId === roomId ? readyAppTarget.url : null

  return {
    snapshot,
    runtimeEvent,
    unavailable,
    publishing,
    restoring,
    restoreError,
    publish,
    restoreDefaultChat,
    refresh,
    appUrl,
  }
}

export interface SpaceSurfaceMember {
  id: string
  clientId: string
  name: string
  displayName: string
  handle: string
  initials: string
  avatarUrl?: string | null
  color: string
  presence: 'online' | 'away' | 'offline'
}

export interface SpaceSurfaceMeta {
  id: string
  name: string
  summary: string
  icon: string
  accent: string
}

export function SpaceAppSurface({
  roomId,
  appUrl,
  reloadKey,
  snapshot,
  runtimeEvent,
  locale,
  meta,
  self,
  members,
  messages,
  typingMemberIds,
  onChatCommand,
  unavailable,
  onRetry,
}: {
  roomId: string
  appUrl: string | null
  reloadKey: number
  snapshot: SpaceRuntimeSnapshot | null
  runtimeEvent: SpaceRuntimeEvent | null
  locale: string
  meta: SpaceSurfaceMeta
  self: SpaceSurfaceMember
  members: SpaceSurfaceMember[]
  messages: ChatMessage[]
  typingMemberIds: string[]
  onChatCommand: (request: SpaceAppBridgeRequest) => Promise<unknown>
  unavailable: boolean
  onRetry: () => void
}) {
  const { t } = useTranslation()
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const hostSnapshot = useMemo(() => {
    const agents = snapshot?.availableAgents?.length
      ? snapshot.availableAgents
      : [{ id: snapshot?.defaultAgentId || 'pi', name: 'Pi', available: true }]
    const activeAgentId = snapshot?.build?.agentId || snapshot?.defaultAgentId || 'pi'
    const activeAgentName = activeAgentId === 'kernel'
      ? 'Kernel'
      : agents.find((agent) => agent.id === activeAgentId)?.name || activeAgentId
    return {
      appId: snapshot?.spaceInstanceId || '',
      locale,
      meta,
      self,
      members,
      mentions: [
        ...agents.map((agent) => ({
          id: agent.id,
          handle: agent.id,
          name: agent.name,
          initials: agent.name.slice(0, 2).toUpperCase(),
          type: 'agent' as const,
          available: agent.available,
        })),
        ...members
          .filter((member) => member.id !== self.id)
          .map((member) => ({
            id: member.id,
            handle: member.handle.replace(/^@/, ''),
            name: member.name,
            initials: member.initials,
            type: 'member' as const,
            available: true,
          })),
      ],
      messages,
      chat: { messages, typingMemberIds },
      app: {
        revision: snapshot?.appState.revision || 0,
        state: snapshot?.appState.state || {},
        presence: snapshot?.appState.presence || [],
      },
      agent: {
        id: activeAgentId,
        name: activeAgentName,
        messages: selectAgentConversationMessages(snapshot),
        build: snapshot?.build || null,
        queue: snapshot?.queue || { activeCount: 0, pendingCount: 0 },
      },
    }
  }, [locale, members, messages, meta, self, snapshot, typingMemberIds])

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
    if (!runtimeEvent || !shouldProjectRuntimeEventToApp(runtimeEvent)) return
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
          const result = parsed.data.action.startsWith('chat.')
            ? await onChatCommand(parsed.data)
            : parsed.data.action === 'theme.set'
              ? undefined
              : await productApi.sendSpaceAppCommand(roomId, parsed.data)
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
  }, [initializeApp, onChatCommand, postToApp, roomId])

  if (!appUrl) {
    return (
      <div
        className="vc-space-app-recovery"
        data-status={unavailable ? 'unavailable' : 'preparing'}
        data-testid="space-app-recovery"
        role="status"
      >
        <span>{unavailable ? <RefreshCw /> : <LoaderCircle />}</span>
        <strong>
          {unavailable
            ? t.chatApp.spaceRuntime.appUnavailable
            : t.chatApp.spaceRuntime.preparingApp}
        </strong>
        <small>
          {unavailable
            ? t.chatApp.spaceRuntime.appUnavailableDescription
            : t.chatApp.spaceRuntime.preparingAppDescription}
        </small>
        {unavailable ? (
          <button type="button" onClick={onRetry}>
            <RefreshCw size={13} />
            {t.chatApp.spaceRuntime.retryApp}
          </button>
        ) : null}
      </div>
    )
  }
  return (
    <div className="vc-space-app-surface" data-testid="space-app-surface">
      <iframe
        ref={iframeRef}
        key={`${appUrl}:${reloadKey}`}
        src={appUrl}
        title={t.chatApp.spaceRuntime.appTitle}
        sandbox="allow-scripts allow-forms allow-popups allow-downloads"
        referrerPolicy="no-referrer"
        onLoad={initializeApp}
      />
    </div>
  )
}

export function SpaceKernelControls({
  runtime,
  onReload,
}: {
  runtime: ReturnType<typeof useSpaceRuntime>
  onReload: () => void
}) {
  const { t } = useTranslation()
  const { snapshot, unavailable, publishing, publish } = runtime
  const building = Boolean(snapshot?.build) || snapshot?.devPreview.state === 'building'
  const revision = snapshot?.project.draftId?.slice(0, 7)
  return (
    <div className="vc-space-kernel" data-testid="space-kernel">
      <span className="vc-space-agent-chip" data-active={building || undefined}>
        <Bot size={13} />
        {snapshot?.defaultAgentId || 'pi'}
        {building ? <i /> : null}
      </span>
      <span className="vc-kernel-revision" data-building={building || undefined}>
        {building ? <LoaderCircle size={13} /> : <CircleCheck size={13} />}
        <span>{building ? t.chatApp.spaceRuntime.updating : t.chatApp.spaceRuntime.ready}</span>
        {revision ? <code>{revision}</code> : null}
      </span>
      <button
        type="button"
        className="vc-kernel-reload"
        onClick={onReload}
        disabled={!runtime.appUrl}
        aria-label={t.chatApp.spaceRuntime.reloadApp}
        title={t.chatApp.spaceRuntime.reloadApp}
      >
        <RefreshCw size={13} />
      </button>
      <button
        type="button"
        className="vc-space-publish"
        disabled={!snapshot?.project.draftId || publishing || unavailable}
        onClick={() => void publish().catch(() => undefined)}
      >
        <Rocket size={13} />
        {publishing ? t.chatApp.spaceRuntime.publishing : t.chatApp.spaceRuntime.publishVersion}
      </button>
    </div>
  )
}
