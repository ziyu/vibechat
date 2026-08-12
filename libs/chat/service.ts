import type {
  ChatState,
  ChatLocale,
  ChatMessage,
  ChatRoom,
} from './types'

export function sortRooms(rooms: ChatRoom[]) {
  return [...rooms].sort((left, right) => {
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1
    if (!!left.unreadCount !== !!right.unreadCount) return left.unreadCount ? -1 : 1
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  })
}

export function filterRooms(
  state: ChatState,
  query: string,
  unreadOnly: boolean,
) {
  const normalized = query.trim().toLocaleLowerCase()
  const people = new Map(state.people.map((person) => [person.id, person]))

  return sortRooms(state.rooms).filter((room) => {
    if (unreadOnly && room.unreadCount === 0) return false
    if (!normalized) return true

    const memberNames = room.memberIds
      .map((id) => people.get(id)?.displayName ?? '')
      .join(' ')
    const messageText = state.messages
      .filter((message) => message.roomId === room.id && !message.deleted)
      .map((message) => `${message.text} ${message.attachment?.name || ''}`)
      .join(' ')
    return `${room.name} ${room.lastMessage} ${memberNames} ${messageText}`
      .toLocaleLowerCase()
      .includes(normalized)
  })
}

export function getRoomMessages(state: ChatState, roomId: string) {
  return state.messages
    .filter((message) => message.roomId === roomId)
    .sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    )
}

export function createChatId(prefix: string) {
  const id = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  return `${prefix}-${id}`
}

export function appendMessageToState(
  state: ChatState,
  message: ChatMessage,
) {
  return {
    ...state,
    messages: [...state.messages, message],
    rooms: state.rooms.map((room) =>
      room.id === message.roomId
        ? {
            ...room,
            lastMessage: message.attachment?.name || message.text,
            updatedAt: message.createdAt,
            unreadCount: 0,
          }
        : room,
    ),
  }
}

export function formatRoomTime(value: string, locale: ChatLocale) {
  const date = new Date(value)
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000))

  if (elapsedMinutes < 1) return locale === 'zh-CN' ? '刚刚' : 'Now'
  if (elapsedMinutes < 60) return locale === 'zh-CN' ? `${elapsedMinutes} 分钟` : `${elapsedMinutes}m`
  if (elapsedMinutes < 24 * 60) {
    const hours = Math.floor(elapsedMinutes / 60)
    return locale === 'zh-CN' ? `${hours} 小时` : `${hours}h`
  }

  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(date)
}

export function formatMessageTime(value: string, locale: ChatLocale) {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
