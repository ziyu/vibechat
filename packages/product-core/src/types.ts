export type ChatLocale = 'en' | 'zh-CN'

export type Presence = 'online' | 'away' | 'offline'

export type MessageDeliveryStatus = 'sending' | 'sent' | 'failed'

export type SpaceCategory = 'daily' | 'focus' | 'play' | 'ritual'

export interface ChatPerson {
  id: string
  matrixUserId?: string | null
  avatarUrl?: string | null
  handle: string
  displayName: string
  initials: string
  color: string
  presence: Presence
  bio: string
}

export interface ChatReaction {
  emoji: string
  userIds: string[]
}

export interface ChatAttachment {
  kind: 'image' | 'file'
  name: string
  mimeType: string
  size: number
  matrixContentUri: string
  downloadUrl?: string
}

export interface ChatMessage {
  id: string
  transactionId?: string
  roomId: string
  senderId: string
  text: string
  createdAt: string
  status: MessageDeliveryStatus
  replyToId?: string
  agentMentions?: Array<{ type: 'agent'; id: string }>
  agent?: boolean
  agentId?: string
  agentTurnId?: string
  agentSourceEventIds?: string[]
  edited?: boolean
  deleted?: boolean
  attachment?: ChatAttachment
  reactions: ChatReaction[]
}

export interface ChatRoom {
  id: string
  name: string
  memberIds: string[]
  spaceId: string
  lastMessage: string
  updatedAt: string
  unreadCount: number
  pinned: boolean
  muted: boolean
  membership?: 'join' | 'invite'
}

export interface AtmosphereSpace {
  schemaVersion: 'vibechat.space-template-market-entry/v1'
  id: string
  versionId: string
  semanticVersion: string
  integrity: string
  sourceHash: string
  manifestHash: string
  artifact: {
    schemaVersion: 'vibechat.space-template-artifact/v1'
    id: string
    format: 'agentos-app-v1'
    sourceHash: string
  }
  projectFormat: 'agentos-app-v1'
  compatibility: {
    spaceAppSdk: 'v1'
    runtime: 'agentos-apps-0.2'
  }
  provenance: {
    origin: 'repository' | 'app'
    publisherId: string
    sourcePath?: string
    sourceRevision?: string
    sourceSpaceRevisionId?: string
    buildId?: string
  }
  publisher: {
    id: string
    displayName: string
    verification: 'official' | 'verified' | 'unverified'
  }
  name: string
  author: string
  summary: string
  category: SpaceCategory
  icon: string
  accent: string
  canvas: string
  permissions: string[]
  networkDomains: string[]
  favoriteCount: number
}

export interface FriendRequest {
  id: string
  personId: string
  createdAt: string
}

export interface ChatState {
  version: 1
  currentUserId: string
  people: ChatPerson[]
  contactIds: string[]
  friendRequests: FriendRequest[]
  blockedUserIds: string[]
  typingUserIdsByRoom: Record<string, string[]>
  rooms: ChatRoom[]
  messages: ChatMessage[]
  spaces: AtmosphereSpace[]
  favoriteSpaceIds: string[]
}

export interface CreateRoomInput {
  participantIds: string[]
  startMode: 'blank' | 'template'
  name: string
  templateId?: string
  templateVersionId?: string
}
