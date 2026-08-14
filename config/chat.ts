export interface BuiltInChatSpaceConfig {
  spaceId: string;
  spaceVersionId: string;
  semanticVersion: string;
  integrity: string;
  category: "daily" | "focus" | "play" | "ritual";
  name: { en: string; "zh-CN": string };
  summary: { en: string; "zh-CN": string };
  author: string;
  icon: string;
  accent: string;
  canvas: string;
  permissions: string[];
  networkDomains: string[];
  official: true;
}

export const builtInChatSpaces: BuiltInChatSpaceConfig[] = [
  {
    spaceId: "space-campfire",
    spaceVersionId: "builtin-space-campfire-v1",
    semanticVersion: "1.0.0",
    integrity: "builtin:space-campfire@1.0.0",
    category: "daily",
    name: { en: "Afterglow Radio", "zh-CN": "夜航电台" },
    summary: {
      en: "A slow-moving late-night radio room for the last thoughts of the day.",
      "zh-CN": "像深夜电台一样缓慢流动的对话空间，适合分享一天最后的心事。",
    },
    author: "Vibe Chat Studio",
    icon: "◐",
    accent: "#ff6b42",
    canvas: "#171b20",
    permissions: ["messages.read", "messages.send", "members.read", "interactions.send"],
    networkDomains: [],
    official: true,
  },
  {
    spaceId: "space-focus",
    spaceVersionId: "builtin-space-focus-v1",
    semanticVersion: "1.0.0",
    integrity: "builtin:space-focus@1.0.0",
    category: "focus",
    name: { en: "Moss Studio", "zh-CN": "苔原共创室" },
    summary: {
      en: "A quiet co-creation table where messages settle like shared notes.",
      "zh-CN": "为小团队准备的安静共创空间，消息会像便签一样落在共享桌面上。",
    },
    author: "Field Notes Lab",
    icon: "⌁",
    accent: "#b7d66d",
    canvas: "#23342b",
    permissions: ["messages.read", "messages.send", "members.read", "state.shared.write"],
    networkDomains: [],
    official: true,
  },
  {
    spaceId: "space-arcade",
    spaceVersionId: "builtin-space-arcade-v1",
    semanticVersion: "1.0.0",
    integrity: "builtin:space-arcade@1.0.0",
    category: "play",
    name: { en: "Pixel Saturday", "zh-CN": "像素星期六" },
    summary: {
      en: "A handheld-console hangout where reactions become collectible pixel badges.",
      "zh-CN": "带一点掌机颗粒感的朋友聚会，回应会变成可以收集的像素徽章。",
    },
    author: "8-Bit Picnic",
    icon: "✦",
    accent: "#ffd84d",
    canvas: "#34274f",
    permissions: ["messages.read", "messages.send", "members.read", "interactions.send"],
    networkDomains: [],
    official: true,
  },
  {
    spaceId: "space-postcard",
    spaceVersionId: "builtin-space-postcard-v1",
    semanticVersion: "1.0.0",
    integrity: "builtin:space-postcard@1.0.0",
    category: "ritual",
    name: { en: "Tomorrow Postcard", "zh-CN": "明日明信片" },
    summary: {
      en: "Send what you feel now to a future moment, then open it together.",
      "zh-CN": "把现在想说的话寄给未来，直到约定的时刻才一起拆开。",
    },
    author: "Vibe Chat Studio",
    icon: "◇",
    accent: "#d84b42",
    canvas: "#efe5d2",
    permissions: ["messages.read", "messages.send", "members.read", "state.shared.write"],
    networkDomains: [],
    official: true,
  },
];

export function getBuiltInChatSpace(spaceId: string) {
  return builtInChatSpaces.find((space) => space.spaceId === spaceId) || null;
}
