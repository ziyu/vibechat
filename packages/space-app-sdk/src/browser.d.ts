export interface SpaceAppMember {
  id: string
  clientId: string
  name: string
  displayName?: string
  handle?: string
  initials?: string
  avatarUrl?: string | null
  color?: string
  presence?: 'online' | 'away' | 'offline'
}

export interface SpaceMentionTarget {
  id: string
  handle: string
  name: string
  initials?: string
  type: 'member' | 'agent'
  available?: boolean
}

export interface SpaceChatMessage {
  id: string
  roomId: string
  senderId: string
  text: string
  createdAt: string
  status: 'sending' | 'sent' | 'failed'
  replyToId?: string
  edited?: boolean
  deleted?: boolean
  attachment?: Record<string, unknown>
  reactions: Array<{ emoji: string; userIds: string[] }>
}

export interface SpaceAppPresence extends SpaceAppMember {
  updatedAt?: string
  [key: string]: unknown
}

export interface SpaceAppStateUpdate {
  revision: number
  values: Record<string, unknown>
  key?: string
  value?: unknown
  deleted?: boolean
}

export interface SpaceAppSnapshot {
  appId: string
  locale: string
  meta: {
    id: string
    name: string
    summary: string
    icon: string
    accent: string
  }
  self: SpaceAppMember | null
  members: SpaceAppMember[]
  mentions: SpaceMentionTarget[]
  messages: SpaceChatMessage[]
  app: {
    revision: number
    state: Record<string, unknown>
    presence: Array<Record<string, unknown>>
  }
  chat: {
    messages: SpaceChatMessage[]
    typingMemberIds: string[]
  }
  agent: {
    id?: string
    name?: string
    messages: Array<Record<string, unknown>>
    build: Record<string, unknown> | null
    queue: { activeCount: number; pendingCount: number }
  }
}

type Unsubscribe = () => void

export interface SpaceAppClient {
  readonly version: number
  readonly ready: Promise<SpaceAppClient>
  readonly appId: string
  readonly locale: string
  readonly meta: SpaceAppSnapshot['meta']
  readonly self: SpaceAppMember | null
  readonly members: SpaceAppMember[]
  readonly messages: SpaceChatMessage[]
  readonly mentions: SpaceMentionTarget[]
  readonly presence: Record<string, SpaceAppPresence>
  readonly presenceList: Array<Record<string, unknown>>
  readonly agent: SpaceAppSnapshot['agent']
  readonly snapshot: SpaceAppSnapshot
  on(type: string, handler: (value: unknown) => void): Unsubscribe
  onEvent(name: string, handler: (event: unknown) => void): Unsubscribe
  updatePresence(value: Record<string, unknown>): Promise<unknown>
  emit(name: string, payload?: unknown): Promise<unknown>
  state: {
    get(key?: string): unknown
    snapshot(): SpaceAppStateUpdate
    set(key: string, value: unknown): Promise<unknown>
    delete(key: string): Promise<unknown>
    on(handler: (update: SpaceAppStateUpdate) => void): Unsubscribe
    on(key: string, handler: (value: unknown, update: SpaceAppStateUpdate) => void): Unsubscribe
  }
  chat: {
    readonly messages: SpaceChatMessage[]
    readonly typingMemberIds: string[]
    send(input: string | {
      text: string
      replyToId?: string
      mentionIds?: string[]
    }): Promise<{ eventId: string }>
    attach(file: File): Promise<{ eventId: string }>
    edit(messageId: string, text: string): Promise<unknown>
    delete(messageId: string): Promise<unknown>
    toggleReaction(messageId: string, emoji: string): Promise<unknown>
    retry(messageId: string): Promise<unknown>
    setTyping(isTyping: boolean): Promise<unknown>
    markRead(): Promise<unknown>
    on(handler: (messages: SpaceChatMessage[]) => void): Unsubscribe
  }
  mention: {
    search(query?: string): SpaceMentionTarget[]
    on(handler: (targets: SpaceMentionTarget[]) => void): Unsubscribe
  }
  theme: {
    set(theme: Record<string, string>): void
  }
}

export const space: Readonly<SpaceAppClient>
