export type ChatLocale = 'en' | 'zh-CN'

export type Presence = 'online' | 'away' | 'offline'

export type MessageDeliveryStatus = 'sending' | 'sent' | 'failed'

export type SpaceCategory = 'daily' | 'focus' | 'play' | 'ritual'

export interface ChatPerson {
  id: string
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

export interface ChatMessage {
  id: string
  roomId: string
  senderId: string
  text: string
  createdAt: string
  status: MessageDeliveryStatus
  replyToId?: string
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
}

export interface AtmosphereSpace {
  id: string
  name: string
  author: string
  summary: string
  category: SpaceCategory
  icon: string
  accent: string
  canvas: string
  permissions: string[]
  networkDomains: string[]
  official: boolean
  favoriteCount: number
}

export interface FriendRequest {
  id: string
  personId: string
  createdAt: string
}

export interface ChatDemoState {
  version: 1
  currentUserId: string
  people: ChatPerson[]
  contactIds: string[]
  friendRequests: FriendRequest[]
  rooms: ChatRoom[]
  messages: ChatMessage[]
  spaces: AtmosphereSpace[]
  favoriteSpaceIds: string[]
}

export interface CreateRoomInput {
  participantIds: string[]
  spaceId: string
}

