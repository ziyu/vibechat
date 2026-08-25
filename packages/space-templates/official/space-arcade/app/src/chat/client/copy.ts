import type { SpaceSdk } from "../../browser/sdk.js";

export interface ChatCopy {
  connected: string;
  members: string;
  empty: string;
  placeholder: string;
  deleted: string;
  edited: string;
  sending: string;
  sent: string;
  failed: string;
  reply: string;
  edit: string;
  remove: string;
  retry: string;
  attach: string;
  attachFile: string;
  agent: string;
  person: string;
  typing: string;
  hint: string;
  working: string;
}

export function getChatCopy(space: SpaceSdk): ChatCopy {
  const copy: Record<"en" | "zh", ChatCopy> = {
    en: {
      connected: "connected",
      members: "members",
      empty: "Chat is ready. Write the first message or mention an Agent to shape this Space.",
      placeholder: "Message this Space…",
      deleted: "This message was deleted",
      edited: "edited",
      sending: "Sending…",
      sent: "Sent",
      failed: "Send failed",
      reply: "Reply",
      edit: "Edit",
      remove: "Delete",
      retry: "Retry",
      attach: "Attachment",
      attachFile: "Attach file",
      agent: "Agent",
      person: "Member",
      typing: "is typing…",
      hint: "Enter to send · type @ to mention a member or Agent",
      working: "is handling your request",
    },
    zh: {
      connected: "实时连接",
      members: "位成员",
      empty: "Chat 已经就绪。发送第一条消息，或 @Agent 定制这个 Space。",
      placeholder: "写给这个 Space…",
      deleted: "这条消息已删除",
      edited: "已编辑",
      sending: "发送中…",
      sent: "已发送",
      failed: "发送失败",
      reply: "回复",
      edit: "编辑",
      remove: "删除",
      retry: "重试",
      attach: "附件",
      attachFile: "添加附件",
      agent: "Agent",
      person: "成员",
      typing: "正在输入…",
      hint: "Enter 发送 · 输入 @ 提及成员或 Agent",
      working: "正在处理你的请求",
    },
  };

  return space.locale === "zh-CN" ? copy.zh : copy.en;
}
