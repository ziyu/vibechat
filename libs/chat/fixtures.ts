import type { ChatDemoState, ChatLocale } from './types'

// Keep the SSR fixture deterministic so the browser hydrates the exact same
// attributes and text that the server rendered. New user messages still use
// the real clock in the app store.
const DEMO_BASE_TIME = Date.parse('2026-08-11T08:52:00.000Z')

const isoMinutesAgo = (minutes: number) =>
  new Date(DEMO_BASE_TIME - minutes * 60_000).toISOString()

export function createDemoChatState(locale: ChatLocale): ChatDemoState {
  const zh = locale === 'zh-CN'

  return {
    version: 1,
    currentUserId: 'person-me',
    people: [
      {
        id: 'person-me',
        handle: '@river',
        displayName: zh ? '小河' : 'River',
        initials: 'R',
        color: '#e4472f',
        presence: 'online',
        bio: zh ? '正在把日常过得有一点浪漫。' : 'Making ordinary days feel a little cinematic.',
      },
      {
        id: 'person-lin',
        handle: '@linlin',
        displayName: zh ? '林林' : 'Lin',
        initials: 'L',
        color: '#256b5d',
        presence: 'online',
        bio: zh ? '胶片、夜路和一杯温水。' : 'Film grain, night walks, and warm water.',
      },
      {
        id: 'person-mira',
        handle: '@mira',
        displayName: zh ? '米拉' : 'Mira',
        initials: 'M',
        color: '#7258a6',
        presence: 'away',
        bio: zh ? '把想法画成会呼吸的东西。' : 'Drawing ideas into things that breathe.',
      },
      {
        id: 'person-aya',
        handle: '@aya',
        displayName: zh ? '阿雅' : 'Aya',
        initials: 'A',
        color: '#b7652f',
        presence: 'online',
        bio: zh ? '周末出逃计划负责人。' : 'Lead planner of small weekend escapes.',
      },
      {
        id: 'person-kai',
        handle: '@kaikai',
        displayName: zh ? '凯' : 'Kai',
        initials: 'K',
        color: '#356b94',
        presence: 'offline',
        bio: zh ? '做音乐，也收集奇怪的声音。' : 'Makes music and collects strange sounds.',
      },
      {
        id: 'person-noah',
        handle: '@noah',
        displayName: zh ? '诺亚' : 'Noah',
        initials: 'N',
        color: '#9b4f53',
        presence: 'online',
        bio: zh ? '我们在纸飞机俱乐部见过。' : 'We met at the Paper Plane Club.',
      },
    ],
    contactIds: ['person-lin', 'person-mira', 'person-aya', 'person-kai'],
    friendRequests: [
      {
        id: 'request-noah',
        personId: 'person-noah',
        createdAt: isoMinutesAgo(38),
      },
    ],
    spaces: [
      {
        id: 'space-campfire',
        name: zh ? '夜航电台' : 'Afterglow Radio',
        author: 'Vibe Chat Studio',
        summary: zh
          ? '像深夜电台一样缓慢流动的对话空间，适合分享一天最后的心事。'
          : 'A slow-moving late-night radio room for the last thoughts of the day.',
        category: 'daily',
        icon: '◐',
        accent: '#ff6b42',
        canvas: '#171b20',
        permissions: ['messages.read', 'messages.send', 'members.read', 'interactions.send'],
        networkDomains: [],
        official: true,
        favoriteCount: 2840,
      },
      {
        id: 'space-focus',
        name: zh ? '苔原共创室' : 'Moss Studio',
        author: 'Field Notes Lab',
        summary: zh
          ? '为小团队准备的安静共创空间，消息会像便签一样落在共享桌面上。'
          : 'A quiet co-creation table where messages settle like shared notes.',
        category: 'focus',
        icon: '⌁',
        accent: '#b7d66d',
        canvas: '#23342b',
        permissions: ['messages.read', 'messages.send', 'members.read', 'state.shared.write'],
        networkDomains: [],
        official: false,
        favoriteCount: 1726,
      },
      {
        id: 'space-arcade',
        name: zh ? '像素星期六' : 'Pixel Saturday',
        author: '8-Bit Picnic',
        summary: zh
          ? '带一点掌机颗粒感的朋友聚会，回应会变成可以收集的像素徽章。'
          : 'A handheld-console hangout where reactions become collectible pixel badges.',
        category: 'play',
        icon: '✦',
        accent: '#ffd84d',
        canvas: '#34274f',
        permissions: ['messages.read', 'messages.send', 'members.read', 'interactions.send'],
        networkDomains: [],
        official: false,
        favoriteCount: 3184,
      },
      {
        id: 'space-postcard',
        name: zh ? '明日明信片' : 'Tomorrow Postcard',
        author: 'Vibe Chat Studio',
        summary: zh
          ? '把现在想说的话寄给未来，直到约定的时刻才一起拆开。'
          : 'Send what you feel now to a future moment, then open it together.',
        category: 'ritual',
        icon: '◇',
        accent: '#d84b42',
        canvas: '#efe5d2',
        permissions: ['messages.read', 'messages.send', 'members.read', 'state.shared.write'],
        networkDomains: [],
        official: true,
        favoriteCount: 2251,
      },
    ],
    rooms: [
      {
        id: 'room-afterglow',
        name: zh ? '夜航 · 林林' : 'Afterglow · Lin',
        memberIds: ['person-me', 'person-lin'],
        spaceId: 'space-campfire',
        lastMessage: zh ? '我把今晚的歌放进来了。' : 'I dropped tonight\'s song in here.',
        updatedAt: isoMinutesAgo(4),
        unreadCount: 2,
        pinned: true,
        muted: false,
      },
      {
        id: 'room-studio',
        name: zh ? '周四小组' : 'Thursday Studio',
        memberIds: ['person-me', 'person-mira', 'person-kai'],
        spaceId: 'space-focus',
        lastMessage: zh ? '第二版的颜色更安静一些。' : 'The second palette feels quieter.',
        updatedAt: isoMinutesAgo(56),
        unreadCount: 0,
        pinned: false,
        muted: false,
      },
      {
        id: 'room-weekend',
        name: zh ? '周末逃跑计划' : 'Weekend Escape Plan',
        memberIds: ['person-me', 'person-aya', 'person-lin', 'person-kai'],
        spaceId: 'space-arcade',
        lastMessage: zh ? '投票：海边还是山里？' : 'Vote: coast or mountains?',
        updatedAt: isoMinutesAgo(132),
        unreadCount: 5,
        pinned: false,
        muted: true,
      },
    ],
    messages: [
      {
        id: 'msg-a1',
        roomId: 'room-afterglow',
        senderId: 'person-lin',
        text: zh ? '刚刚路过一家还亮着灯的唱片店。' : 'I just passed a record shop that was still glowing.',
        createdAt: isoMinutesAgo(34),
        status: 'sent',
        reactions: [{ emoji: '🌙', userIds: ['person-me'] }],
      },
      {
        id: 'msg-a2',
        roomId: 'room-afterglow',
        senderId: 'person-me',
        text: zh ? '听起来像今晚应该停下来的一站。' : 'Sounds like a stop the night wanted you to make.',
        createdAt: isoMinutesAgo(28),
        status: 'sent',
        replyToId: 'msg-a1',
        reactions: [],
      },
      {
        id: 'msg-a3',
        roomId: 'room-afterglow',
        senderId: 'person-lin',
        text: zh ? '老板在放一张旧爵士，窗上都是雨。' : 'The owner had an old jazz record on. Rain all over the window.',
        createdAt: isoMinutesAgo(9),
        status: 'sent',
        reactions: [{ emoji: '♥', userIds: ['person-me'] }],
      },
      {
        id: 'msg-a4',
        roomId: 'room-afterglow',
        senderId: 'person-lin',
        text: zh ? '我把今晚的歌放进来了。' : 'I dropped tonight\'s song in here.',
        createdAt: isoMinutesAgo(4),
        status: 'sent',
        reactions: [],
      },
      {
        id: 'msg-s1',
        roomId: 'room-studio',
        senderId: 'person-mira',
        text: zh ? '我把开场页的层级重新排了一遍。' : 'I reworked the hierarchy on the opening screen.',
        createdAt: isoMinutesAgo(92),
        status: 'sent',
        reactions: [{ emoji: '👀', userIds: ['person-kai', 'person-me'] }],
      },
      {
        id: 'msg-s2',
        roomId: 'room-studio',
        senderId: 'person-kai',
        text: zh ? '第二版的颜色更安静一些。' : 'The second palette feels quieter.',
        createdAt: isoMinutesAgo(56),
        status: 'sent',
        reactions: [],
      },
      {
        id: 'msg-w1',
        roomId: 'room-weekend',
        senderId: 'person-aya',
        text: zh ? '这次真的不带电脑，好吗？' : 'No laptops this time, for real?',
        createdAt: isoMinutesAgo(168),
        status: 'sent',
        reactions: [{ emoji: '🤝', userIds: ['person-me', 'person-lin', 'person-kai'] }],
      },
      {
        id: 'msg-w2',
        roomId: 'room-weekend',
        senderId: 'person-aya',
        text: zh ? '投票：海边还是山里？' : 'Vote: coast or mountains?',
        createdAt: isoMinutesAgo(132),
        status: 'sent',
        reactions: [],
      },
    ],
    favoriteSpaceIds: ['space-campfire', 'space-postcard'],
  }
}
