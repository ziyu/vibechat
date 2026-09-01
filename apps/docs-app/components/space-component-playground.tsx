'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  defineSpaceElements,
  spaceChatEventNames,
  spaceUserEventNames,
  type SpaceAgentActivityElement,
  type SpaceAgentActivityView,
  type SpaceChatAuthorView,
  type SpaceChatComposerElement,
  type SpaceChatMessageView,
  type SpaceChatTimelineElement,
  type SpaceMemberListElement,
  type SpaceUserIdentityView,
} from '@vibechat/space-app-components'
import styles from './space-component-playground.module.css'

export interface SpaceComponentPlaygroundCopy {
  readonly eyebrow: string
  readonly title: string
  readonly description: string
  readonly signalTheme: string
  readonly paperTheme: string
  readonly startAgent: string
  readonly stopAgent: string
  readonly userPanel: string
  readonly agentPanel: string
  readonly chatPanel: string
  readonly selectedMember: string
  readonly noMemberSelected: string
  readonly agentStage: string
  readonly agentActivityRead: string
  readonly agentActivityWrite: string
  readonly firstMessage: string
  readonly secondMessage: string
}

interface SpaceComponentPlaygroundProps {
  readonly locale: 'en' | 'zh-CN'
  readonly copy: SpaceComponentPlaygroundCopy
}

const alice: SpaceUserIdentityView = Object.freeze({
  id: 'alice',
  name: 'Alice Chen',
  handle: 'alice.maps',
  avatarUrl: null,
  presence: 'online',
})

const morgan: SpaceUserIdentityView = Object.freeze({
  id: 'morgan',
  name: 'Morgan 夜航电台',
  handle: 'morgan.radio',
  avatarUrl: null,
  presence: 'away',
})

const self: SpaceChatAuthorView = Object.freeze({
  id: 'self',
  kind: 'member',
  name: 'You',
  handle: 'you',
  avatarUrl: null,
  isSelf: true,
})

const wayfinder: SpaceChatAuthorView = Object.freeze({
  id: 'wayfinder',
  kind: 'agent',
  name: 'Wayfinder',
  handle: 'wayfinder',
  avatarUrl: null,
  isSelf: false,
})

function sampleMessages(copy: SpaceComponentPlaygroundCopy): SpaceChatMessageView[] {
  return [
    {
      id: 'catalog-first',
      roomId: 'component-catalog',
      author: { ...alice, kind: 'member', isSelf: false },
      text: copy.firstMessage,
      createdAt: '2026-08-31T08:00:00.000Z',
      status: 'sent',
      isOwn: false,
      isAgent: false,
      edited: false,
      deleted: false,
      reply: null,
      reactions: [{ emoji: '✨', count: 2, reactedBySelf: true }],
      actions: { reply: true, edit: false, delete: false, retry: false, react: true },
      hasAttachment: false,
    },
    {
      id: 'catalog-agent',
      roomId: 'component-catalog',
      author: wayfinder,
      text: copy.secondMessage,
      createdAt: '2026-08-31T08:01:00.000Z',
      status: 'sent',
      isOwn: false,
      isAgent: true,
      edited: false,
      deleted: false,
      reply: null,
      reactions: [],
      actions: { reply: true, edit: false, delete: false, retry: false, react: true },
      hasAttachment: false,
    },
  ]
}

function agentActivity(
  active: boolean,
  copy: SpaceComponentPlaygroundCopy,
): SpaceAgentActivityView {
  return Object.freeze({
    agent: Object.freeze({
      id: 'wayfinder',
      name: 'Wayfinder',
      avatarUrl: null,
      status: active ? 'working' : 'idle',
      summary: null,
      activeCount: active ? 1 : 0,
      pendingCount: active ? 2 : 0,
    }),
    active,
    stage: active ? copy.agentStage : null,
    queue: Object.freeze({ activeCount: active ? 1 : 0, pendingCount: active ? 2 : 0 }),
    activities: active
      ? Object.freeze([
          Object.freeze({
            id: 'catalog-read',
            label: copy.agentActivityRead,
            detail: null,
            status: 'completed' as const,
          }),
          Object.freeze({
            id: 'catalog-write',
            label: copy.agentActivityWrite,
            detail: null,
            status: 'active' as const,
          }),
        ])
      : Object.freeze([]),
  })
}

export function SpaceComponentPlayground({
  locale,
  copy,
}: SpaceComponentPlaygroundProps) {
  const [theme, setTheme] = useState<'signal' | 'paper'>('signal')
  const [agentActive, setAgentActive] = useState(true)
  const [selectedMember, setSelectedMember] = useState<string | null>(null)
  const [messages, setMessages] = useState(() => sampleMessages(copy))
  const memberListRef = useRef<SpaceMemberListElement | null>(null)
  const activityRef = useRef<SpaceAgentActivityElement | null>(null)
  const timelineRef = useRef<SpaceChatTimelineElement | null>(null)
  const composerRef = useRef<SpaceChatComposerElement | null>(null)
  const users = useMemo(() => Object.freeze([alice, morgan]), [])

  useEffect(() => {
    defineSpaceElements()
  }, [])

  useEffect(() => {
    const list = memberListRef.current
    if (!list) return
    list.users = users
    list.selectedUserId = selectedMember
    list.disabledUserIds = []
  }, [selectedMember, users])

  useEffect(() => {
    const activity = activityRef.current
    if (activity) activity.activity = agentActivity(agentActive, copy)
  }, [agentActive, copy])

  useEffect(() => {
    const timeline = timelineRef.current
    if (!timeline) return
    timeline.state = 'ready'
    timeline.messages = messages
    timeline.typingUsers = []
    timeline.interactive = true
    timeline.interactionDisabled = false
    timeline.reactionChoices = ['✨', '♥', '🌙']
  }, [messages])

  useEffect(() => {
    const root = memberListRef.current
    if (!root) return
    const onSelect = (event: Event) => {
      const detail = (event as CustomEvent<{ user: SpaceUserIdentityView }>).detail
      setSelectedMember(detail.user.id)
    }
    root.addEventListener(spaceUserEventNames.memberSelect, onSelect)
    return () => root.removeEventListener(spaceUserEventNames.memberSelect, onSelect)
  }, [])

  useEffect(() => {
    const composer = composerRef.current
    if (!composer) return
    const onSubmit = (event: Event) => {
      const detail = (event as CustomEvent<{ text: string }>).detail
      const text = detail.text.trim()
      if (!text) return
      setMessages((current) => [
        ...current,
        {
          id: `catalog-${crypto.randomUUID()}`,
          roomId: 'component-catalog',
          author: self,
          text,
          createdAt: new Date().toISOString(),
          status: 'sent',
          isOwn: true,
          isAgent: false,
          edited: false,
          deleted: false,
          reply: null,
          reactions: [],
          actions: { reply: true, edit: true, delete: true, retry: false, react: true },
          hasAttachment: false,
        },
      ])
      composer.draft = ''
    }
    composer.addEventListener(spaceChatEventNames.submit, onSubmit)
    return () => composer.removeEventListener(spaceChatEventNames.submit, onSubmit)
  }, [])

  const selected = users.find((user) => user.id === selectedMember)

  return (
    <section className={styles.frame} data-theme={theme} aria-label={copy.title}>
      <div className={styles.masthead}>
        <div>
          <span className={styles.eyebrow}>{copy.eyebrow}</span>
          <h2>{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
        <div className={styles.controls}>
          <div className={styles.segmented} aria-label={copy.title}>
            <button
              type="button"
              aria-pressed={theme === 'signal'}
              onClick={() => setTheme('signal')}
            >
              {copy.signalTheme}
            </button>
            <button
              type="button"
              aria-pressed={theme === 'paper'}
              onClick={() => setTheme('paper')}
            >
              {copy.paperTheme}
            </button>
          </div>
          <button
            type="button"
            className={styles.agentToggle}
            aria-pressed={agentActive}
            onClick={() => setAgentActive((value) => !value)}
          >
            <span aria-hidden="true" />
            {agentActive ? copy.stopAgent : copy.startAgent}
          </button>
        </div>
      </div>

      <div className={styles.catalogGrid}>
        <article className={`${styles.panel} ${styles.userPanel}`}>
          <header><span>01</span><h3>{copy.userPanel}</h3></header>
          <div className={styles.userCard}>
            <vc-space-user-info-card
              locale={locale}
              user-id="alice"
              name="Alice Chen"
              handle="alice.maps"
              presence="online"
            />
          </div>
          <vc-space-member-list
            ref={(element) => { memberListRef.current = element }}
            locale={locale}
            aria-label={copy.userPanel}
          />
          <output className={styles.selection} aria-live="polite">
            {selected
              ? `${copy.selectedMember}: ${selected.name}`
              : copy.noMemberSelected}
          </output>
        </article>

        <article className={`${styles.panel} ${styles.agentPanel}`}>
          <header><span>02</span><h3>{copy.agentPanel}</h3></header>
          <vc-space-agent-activity
            ref={(element) => { activityRef.current = element }}
            locale={locale}
          />
        </article>

        <article className={`${styles.panel} ${styles.chatPanel}`}>
          <header><span>03</span><h3>{copy.chatPanel}</h3></header>
          <div className={styles.chatStack}>
            <vc-space-chat-timeline
              ref={(element) => { timelineRef.current = element }}
              locale={locale}
            />
            <vc-space-chat-composer
              ref={(element) => { composerRef.current = element }}
              locale={locale}
              maxlength="400"
            />
          </div>
        </article>
      </div>
    </section>
  )
}
