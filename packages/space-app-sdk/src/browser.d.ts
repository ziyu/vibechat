export interface SpaceAppMember {
  id: string
  clientId: string
  name: string
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
  self: SpaceAppMember | null
  members: SpaceAppMember[]
  messages: Array<Record<string, unknown>>
  app: {
    revision: number
    state: Record<string, unknown>
    presence: Array<Record<string, unknown>>
  }
  agent: {
    id?: string
    name?: string
    build: Record<string, unknown> | null
    queue: { activeCount: number; pendingCount: number }
  }
}

type Unsubscribe = () => void

export interface SpaceAppClient {
  readonly version: number
  readonly ready: Promise<SpaceAppClient>
  readonly appId: string
  readonly self: SpaceAppMember | null
  readonly members: SpaceAppMember[]
  readonly messages: Array<Record<string, unknown>>
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
    send(text: string): Promise<unknown>
    on(handler: (message: unknown) => void): Unsubscribe
  }
  theme: {
    set(theme: Record<string, string>): void
  }
}

export const space: Readonly<SpaceAppClient>
