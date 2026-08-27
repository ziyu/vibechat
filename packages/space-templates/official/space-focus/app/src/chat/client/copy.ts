import type { SpaceSdk } from "../../browser/sdk.js";

export interface ChatCopy {
  connected: string;
  members: string;
  empty: string;
  hint: string;
  working: string;
  title: string;
  open: string;
  close: string;
  region: string;
  timeline: string;
}

export function getChatCopy(space: SpaceSdk): ChatCopy {
  const copy: Record<"en" | "zh", ChatCopy> = {
    en: {
      connected: "connected",
      members: "members",
      empty: "Chat is ready. Write the first message or mention an Agent to shape this Space.",
      hint: "Enter to send · type @ to mention a member or Agent",
      working: "is handling your request",
      title: "Chat",
      open: "Open Space Chat",
      close: "Close Chat",
      region: "Space Chat",
      timeline: "Message timeline",
    },
    zh: {
      connected: "实时连接",
      members: "位成员",
      empty: "Chat 已经就绪。发送第一条消息，或 @Agent 定制这个 Space。",
      hint: "Enter 发送 · 输入 @ 提及成员或 Agent",
      working: "正在处理你的请求",
      title: "聊天",
      open: "打开 Space 聊天",
      close: "关闭聊天",
      region: "Space 聊天",
      timeline: "消息时间线",
    },
  };

  return space.locale === "zh-CN" ? copy.zh : copy.en;
}
