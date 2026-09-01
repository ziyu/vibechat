import type { SpaceAppClient } from "@vibechat/space-app-sdk";

export type SpaceComponentTranslationParams = Readonly<
  Record<string, string | number>
>;

export type SpaceComponentTranslator = (
  key: string,
  params?: SpaceComponentTranslationParams,
) => string;

export interface SpaceComponentLogger {
  debug(message: string, detail?: Readonly<Record<string, unknown>>): void;
  warn(message: string, detail?: Readonly<Record<string, unknown>>): void;
}

export interface SpaceComponentContextOptions {
  sdk: SpaceAppClient;
  locale?: string;
  translate?: SpaceComponentTranslator;
  theme?: Readonly<Record<string, string>>;
  logger?: SpaceComponentLogger;
}

export interface SpaceComponentContext {
  readonly sdk: SpaceAppClient;
  readonly locale: string;
  readonly theme: Readonly<Record<string, string>>;
  readonly logger: SpaceComponentLogger;
  readonly signal: AbortSignal;
  readonly disposed: boolean;
  translate: SpaceComponentTranslator;
  addDisposable(disposable: () => void): () => void;
  listen(
    type: string,
    handler: (value: unknown) => void,
  ): () => void;
  dispose(): void;
}

const catalogs: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  en: {
    "space.components.avatar.label": "{name} avatar",
    "space.components.user.card.label": "{name} identity",
    "space.components.user.presence.label": "{name}: {status}",
    "space.components.user.members.label": "Space members",
    "space.components.user.members.empty": "No members to show",
    "space.components.user.member.label": "{name}, {status}",
    "space.components.user.member.handle-label": "{name}, {handle}, {status}",
    "space.components.presence.online": "Online",
    "space.components.presence.away": "Away",
    "space.components.presence.offline": "Offline",
    "space.components.agent.avatar.label": "{name}, Agent avatar",
    "space.components.agent.badge": "Agent",
    "space.components.agent.card.label": "{name}, Agent identity",
    "space.components.agent.status.idle": "Ready",
    "space.components.agent.status.queued": "Queued",
    "space.components.agent.status.working": "Working",
    "space.components.agent.status.unavailable": "Unavailable",
    "space.components.agent.status.failed": "Needs attention",
    "space.components.agent.queue": "{active} active · {pending} pending",
    "space.components.agent.activity.label": "{name} activity",
    "space.components.agent.activity.idle": "Ready for the next request",
    "space.components.agent.activity.queued": "Waiting in the queue",
    "space.components.agent.activity.working": "Working on this Space",
    "space.components.agent.activity.unavailable": "Agent unavailable",
    "space.components.agent.activity.failed": "Activity needs attention",
    "space.components.agent.activity.item": "Activity {position}",
    "space.components.agent.activity.status.queued": "Queued",
    "space.components.agent.activity.status.active": "In progress",
    "space.components.agent.activity.status.completed": "Completed",
    "space.components.agent.activity.status.failed": "Failed",
    "space.components.agent.activity.status.unknown": "Update",
    "space.components.chat.attachment": "Attachment",
    "space.components.chat.author.avatar": "{author} avatar",
    "space.components.chat.author.card.open": "View {author} profile",
    "space.components.chat.deleted": "Message deleted",
    "space.components.chat.delivery.failed": "Failed to send",
    "space.components.chat.delivery.sending": "Sending",
    "space.components.chat.delivery.sent": "Sent",
    "space.components.chat.edited": "Edited",
    "space.components.chat.message.label": "Message from {author}",
    "space.components.chat.reaction.label": "{emoji}, {count} reactions",
    "space.components.chat.reactions.label": "Message reactions",
    "space.components.chat.reply.available": "Reply",
    "space.components.chat.reply.deleted": "Deleted message",
    "space.components.chat.reply.label": "Reply to {author}",
    "space.components.chat.reply.missing": "Original message unavailable",
    "space.components.chat.time.unknown": "Unknown time",
    "space.components.chat.typing.many": "{names} are typing",
    "space.components.chat.typing.one": "{names} is typing",
    "space.components.chat.action.delete": "Delete",
    "space.components.chat.action.edit": "Edit",
    "space.components.chat.action.close": "Close",
    "space.components.chat.action.confirm-delete": "Confirm delete",
    "space.components.chat.action.menu": "More message actions",
    "space.components.chat.action.reply": "Reply",
    "space.components.chat.action.retry": "Retry",
    "space.components.chat.composer.attach": "Attach",
    "space.components.chat.composer.pending": "Sending",
    "space.components.chat.composer.placeholder": "Message this Space",
    "space.components.chat.composer.send": "Send",
    "space.components.chat.context.cancel": "Cancel",
    "space.components.chat.context.edit": "Editing {author}: {text}",
    "space.components.chat.context.reply": "Replying to {author}: {text}",
    "space.components.chat.error.dismiss": "Dismiss",
    "space.components.chat.mention.agent": "Agent",
    "space.components.chat.mention.label": "Mention a member or Agent",
    "space.components.chat.mention.member": "Member",
    "space.components.chat.mention.unavailable": "Unavailable",
    "space.components.mention.agent": "Agent",
    "space.components.mention.member": "Member",
    "space.components.mention.unavailable": "Unavailable",
    "space.components.mention.target.label": "{name}, {handle}, {kind}",
    "space.components.chat.reaction.button": "{emoji}, {count} reactions, {current}",
    "space.components.chat.reaction.add": "Add a reaction",
    "space.components.chat.reaction.choice": "React with {emoji}",
    "space.components.chat.reaction.current": "selected by you",
    "space.components.chat.reaction.not-current": "not selected by you",
    "space.components.chat.timeline.empty": "Chat is ready. Write the first message.",
    "space.components.chat.timeline.error": "Chat could not be loaded.",
    "space.components.chat.timeline.loading": "Loading Chat",
    "space.components.catalog.eyebrow": "Space component signal atlas",
  },
  "zh-CN": {
    "space.components.avatar.label": "{name}的头像",
    "space.components.user.card.label": "{name}的身份信息",
    "space.components.user.presence.label": "{name}：{status}",
    "space.components.user.members.label": "Space 成员",
    "space.components.user.members.empty": "暂无成员",
    "space.components.user.member.label": "{name}，{status}",
    "space.components.user.member.handle-label": "{name}，{handle}，{status}",
    "space.components.presence.online": "在线",
    "space.components.presence.away": "暂离",
    "space.components.presence.offline": "离线",
    "space.components.agent.avatar.label": "Agent {name}的头像",
    "space.components.agent.badge": "Agent",
    "space.components.agent.card.label": "Agent {name}的身份信息",
    "space.components.agent.status.idle": "可用",
    "space.components.agent.status.queued": "排队中",
    "space.components.agent.status.working": "工作中",
    "space.components.agent.status.unavailable": "不可用",
    "space.components.agent.status.failed": "需要处理",
    "space.components.agent.queue": "{active} 个进行中 · {pending} 个等待中",
    "space.components.agent.activity.label": "Agent {name}的活动",
    "space.components.agent.activity.idle": "等待下一项请求",
    "space.components.agent.activity.queued": "正在队列中等待",
    "space.components.agent.activity.working": "正在处理这个 Space",
    "space.components.agent.activity.unavailable": "Agent 当前不可用",
    "space.components.agent.activity.failed": "活动需要处理",
    "space.components.agent.activity.item": "活动 {position}",
    "space.components.agent.activity.status.queued": "等待中",
    "space.components.agent.activity.status.active": "进行中",
    "space.components.agent.activity.status.completed": "已完成",
    "space.components.agent.activity.status.failed": "失败",
    "space.components.agent.activity.status.unknown": "状态更新",
    "space.components.chat.attachment": "附件",
    "space.components.chat.author.avatar": "{author}的头像",
    "space.components.chat.author.card.open": "查看{author}的资料",
    "space.components.chat.deleted": "消息已删除",
    "space.components.chat.delivery.failed": "发送失败",
    "space.components.chat.delivery.sending": "发送中",
    "space.components.chat.delivery.sent": "已发送",
    "space.components.chat.edited": "已编辑",
    "space.components.chat.message.label": "{author}发送的消息",
    "space.components.chat.reaction.label": "{emoji}，{count} 个回应",
    "space.components.chat.reactions.label": "消息回应",
    "space.components.chat.reply.available": "回复",
    "space.components.chat.reply.deleted": "消息已删除",
    "space.components.chat.reply.label": "回复{author}",
    "space.components.chat.reply.missing": "原消息不可用",
    "space.components.chat.time.unknown": "时间未知",
    "space.components.chat.typing.many": "{names}正在输入",
    "space.components.chat.typing.one": "{names}正在输入",
    "space.components.chat.action.delete": "删除",
    "space.components.chat.action.edit": "编辑",
    "space.components.chat.action.close": "关闭",
    "space.components.chat.action.confirm-delete": "确认删除",
    "space.components.chat.action.menu": "更多消息操作",
    "space.components.chat.action.reply": "回复",
    "space.components.chat.action.retry": "重试",
    "space.components.chat.composer.attach": "附件",
    "space.components.chat.composer.pending": "发送中",
    "space.components.chat.composer.placeholder": "写给这个 Space",
    "space.components.chat.composer.send": "发送",
    "space.components.chat.context.cancel": "取消",
    "space.components.chat.context.edit": "正在编辑 {author}：{text}",
    "space.components.chat.context.reply": "正在回复 {author}：{text}",
    "space.components.chat.error.dismiss": "关闭",
    "space.components.chat.mention.agent": "Agent",
    "space.components.chat.mention.label": "提及成员或 Agent",
    "space.components.chat.mention.member": "成员",
    "space.components.chat.mention.unavailable": "不可用",
    "space.components.mention.agent": "Agent",
    "space.components.mention.member": "成员",
    "space.components.mention.unavailable": "不可用",
    "space.components.mention.target.label": "{name}，{handle}，{kind}",
    "space.components.chat.reaction.button": "{emoji}，{count} 个回应，{current}",
    "space.components.chat.reaction.add": "添加回应",
    "space.components.chat.reaction.choice": "用 {emoji} 回应",
    "space.components.chat.reaction.current": "你已选择",
    "space.components.chat.reaction.not-current": "你未选择",
    "space.components.chat.timeline.empty": "Chat 已就绪，发送第一条消息。",
    "space.components.chat.timeline.error": "Chat 加载失败。",
    "space.components.chat.timeline.loading": "正在加载 Chat",
    "space.components.catalog.eyebrow": "Space 组件信号图谱",
  },
};

const silentLogger: SpaceComponentLogger = Object.freeze({
  debug() {},
  warn() {},
});

function resolveLocale(locale: string) {
  return locale.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

function interpolate(
  template: string,
  params: SpaceComponentTranslationParams = {},
) {
  return template.replace(/\{([\w.-]+)\}/g, (_match, key: string) =>
    Object.hasOwn(params, key) ? String(params[key]) : `{${key}}`);
}

export function createSpaceComponentTranslator(
  locale: string,
): SpaceComponentTranslator {
  const resolved = resolveLocale(locale);
  return (key, params) => {
    const template = catalogs[resolved]?.[key] ?? catalogs.en[key] ?? key;
    return interpolate(template, params);
  };
}

export function createSpaceComponentContext(
  options: SpaceComponentContextOptions,
): SpaceComponentContext {
  if (!options?.sdk || typeof options.sdk.on !== "function") {
    throw new TypeError("Space component context requires an injected SDK client");
  }

  const controller = new AbortController();
  const disposables = new Set<() => void>();
  const locale = options.locale || options.sdk.locale || "en";
  const translate = options.translate ?? createSpaceComponentTranslator(locale);
  let disposed = false;

  const context: SpaceComponentContext = {
    sdk: options.sdk,
    locale,
    theme: Object.freeze({ ...(options.theme ?? {}) }),
    logger: options.logger ?? silentLogger,
    signal: controller.signal,
    get disposed() {
      return disposed;
    },
    translate,
    addDisposable(disposable) {
      if (typeof disposable !== "function") {
        throw new TypeError("Space component disposable must be a function");
      }
      if (disposed) {
        disposable();
        return () => {};
      }
      disposables.add(disposable);
      return () => disposables.delete(disposable);
    },
    listen(type, handler) {
      if (disposed) return () => {};
      const unsubscribe = options.sdk.on(type, handler);
      const remove = context.addDisposable(unsubscribe);
      return () => {
        remove();
        unsubscribe();
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      controller.abort();
      for (const disposable of [...disposables].reverse()) {
        try {
          disposable();
        } catch (error) {
          context.logger.warn("Space component cleanup failed", {
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      }
      disposables.clear();
    },
  };

  return context;
}
