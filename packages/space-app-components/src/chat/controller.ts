import type {
  SpaceAppSnapshot,
  SpaceMentionTarget,
} from "@vibechat/space-app-sdk";
import type { SpaceComponentContext } from "../core/context.js";
import {
  createSpaceChatMessageViews,
  resolveSpaceChatAuthor,
  type SpaceChatAuthorView,
  type SpaceChatMessageView,
} from "./view.js";

export interface SpaceChatTimelineSnapshot {
  readonly messages: readonly SpaceChatMessageView[];
  readonly typingUsers: readonly SpaceChatAuthorView[];
  readonly ready: boolean;
  readonly disposed: boolean;
}

export interface SpaceChatTimelineController {
  readonly ready: Promise<void>;
  readonly disposed: boolean;
  getSnapshot(): SpaceChatTimelineSnapshot;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

export type SpaceChatCommand =
  | "send"
  | "attach"
  | "edit"
  | "delete"
  | "reaction"
  | "retry"
  | "typing"
  | "mark-read";

export interface SpaceChatCommandError {
  readonly command: SpaceChatCommand;
  readonly message: string;
}

export interface SpaceChatDraftContext {
  readonly kind: "reply" | "edit";
  readonly message: SpaceChatMessageView;
}

export interface SpaceChatSnapshot extends SpaceChatTimelineSnapshot {
  readonly draft: string;
  readonly mentionIds: readonly string[];
  readonly mentionTargets: readonly SpaceMentionTarget[];
  readonly context: SpaceChatDraftContext | null;
  readonly pending: SpaceChatCommand | null;
  readonly error: SpaceChatCommandError | null;
  readonly typing: boolean;
}

export interface SpaceChatController {
  readonly ready: Promise<void>;
  readonly disposed: boolean;
  getSnapshot(): SpaceChatSnapshot;
  subscribe(listener: () => void): () => void;
  setDraft(value: string, mentionIds?: readonly string[]): void;
  beginReply(message: SpaceChatMessageView | string): void;
  beginEdit(message: SpaceChatMessageView | string): void;
  cancelContext(): void;
  searchMentions(query?: string): readonly SpaceMentionTarget[];
  selectMention(target: SpaceMentionTarget): void;
  send(): Promise<unknown>;
  attach(file: File): Promise<unknown>;
  edit(messageId: string, text: string): Promise<unknown>;
  delete(messageId: string): Promise<unknown>;
  toggleReaction(messageId: string, emoji: string): Promise<unknown>;
  retry(messageId: string): Promise<unknown>;
  setTyping(isTyping: boolean): Promise<void>;
  markRead(): Promise<unknown>;
  clearError(): void;
  dispose(): void;
}

function memberIdentitySignature(snapshot: SpaceAppSnapshot) {
  return JSON.stringify([snapshot.self, ...snapshot.members].map((member) =>
    member && [
      member.id,
      member.displayName || "",
      member.name || "",
      member.handle || "",
      member.avatarUrl || "",
    ]));
}

function typingUsers(snapshot: SpaceAppSnapshot) {
  const ids = [...new Set(
    (Array.isArray(snapshot.chat?.typingMemberIds)
      ? snapshot.chat.typingMemberIds
      : [])
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  )];
  return Object.freeze(ids.map((id) => resolveSpaceChatAuthor(snapshot, id)));
}

export function createSpaceChatTimelineController(
  context: SpaceComponentContext,
): SpaceChatTimelineController {
  const listeners = new Set<() => void>();
  const unsubscribes: Array<() => void> = [];
  let disposed = context.disposed;
  let identitySignature = memberIdentitySignature(context.sdk.snapshot);
  let state: SpaceChatTimelineSnapshot = Object.freeze({
    messages: createSpaceChatMessageViews(context.sdk.snapshot),
    typingUsers: typingUsers(context.sdk.snapshot),
    ready: false,
    disposed,
  });
  let removeFromContext = () => {};

  const publish = (next: SpaceChatTimelineSnapshot) => {
    if (disposed) return;
    state = Object.freeze(next);
    for (const listener of listeners) listener();
  };

  const refreshMessages = () => {
    const snapshot = context.sdk.snapshot;
    publish({
      ...state,
      messages: createSpaceChatMessageViews(snapshot),
    });
  };

  const refreshTyping = () => {
    publish({
      ...state,
      typingUsers: typingUsers(context.sdk.snapshot),
    });
  };

  const refreshMemberIdentity = () => {
    const snapshot = context.sdk.snapshot;
    const nextSignature = memberIdentitySignature(snapshot);
    if (nextSignature === identitySignature) return;
    identitySignature = nextSignature;
    publish({
      ...state,
      messages: createSpaceChatMessageViews(snapshot),
      typingUsers: typingUsers(snapshot),
    });
  };

  const controller: SpaceChatTimelineController = {
    ready: disposed
      ? Promise.resolve()
      : context.sdk.ready.then(() => {
          if (disposed) return;
          const snapshot = context.sdk.snapshot;
          identitySignature = memberIdentitySignature(snapshot);
          publish({
            messages: createSpaceChatMessageViews(snapshot),
            typingUsers: typingUsers(snapshot),
            ready: true,
            disposed: false,
          });
        }),
    get disposed() {
      return disposed;
    },
    getSnapshot() {
      return state;
    },
    subscribe(listener) {
      if (typeof listener !== "function") {
        throw new TypeError("Space Chat timeline listener must be a function");
      }
      if (disposed) return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      removeFromContext();
      for (const unsubscribe of unsubscribes.splice(0).reverse()) unsubscribe();
      state = Object.freeze({ ...state, disposed: true });
      for (const listener of listeners) listener();
      listeners.clear();
    },
  };

  if (!disposed) {
    unsubscribes.push(
      context.sdk.on("messages", refreshMessages),
      context.sdk.on("typing", refreshTyping),
      context.sdk.on("members", refreshMemberIdentity),
      context.sdk.on("mentions", refreshMessages),
      context.sdk.on("agent", refreshMessages),
    );
    removeFromContext = context.addDisposable(() => controller.dispose());
  }

  return controller;
}

const typingIdleMilliseconds = 3500;

function commandError(
  command: SpaceChatCommand,
  reason: unknown,
): SpaceChatCommandError {
  const message = reason instanceof Error
    ? reason.message
    : typeof reason === "string"
      ? reason
      : "Chat command failed";
  return Object.freeze({ command, message });
}

function resolveContextMessage(
  messages: readonly SpaceChatMessageView[],
  value: SpaceChatMessageView | string,
) {
  return typeof value === "string"
    ? messages.find((message) => message.id === value) ?? null
    : value;
}

/**
 * Owns Template-facing Chat interaction state while delegating every effect to
 * the injected SDK. Matrix, Agent dispatch, ACL and billing remain Host-owned.
 */
export function createSpaceChatController(
  context: SpaceComponentContext,
): SpaceChatController {
  const timeline = createSpaceChatTimelineController(context);
  const listeners = new Set<() => void>();
  let disposed = context.disposed;
  let typingTimer: ReturnType<typeof setTimeout> | null = null;
  let typingActive = false;
  let removeFromContext = () => {};
  let state: SpaceChatSnapshot = Object.freeze({
    ...timeline.getSnapshot(),
    draft: "",
    mentionIds: Object.freeze([]),
    mentionTargets: Object.freeze([]),
    context: null,
    pending: null,
    error: null,
    typing: false,
  });

  const publish = (next: SpaceChatSnapshot) => {
    if (disposed) return;
    state = Object.freeze(next);
    for (const listener of listeners) listener();
  };

  const stopTypingTimer = () => {
    if (typingTimer === null) return;
    clearTimeout(typingTimer);
    typingTimer = null;
  };

  const setTypingEffect = async (isTyping: boolean) => {
    stopTypingTimer();
    if (isTyping) {
      if (!typingActive) await context.sdk.chat.setTyping(true);
      typingActive = true;
      publish({ ...state, typing: true });
      typingTimer = setTimeout(() => {
        typingTimer = null;
        void setTypingEffect(false).catch((reason) => {
          if (!disposed) publish({
            ...state,
            error: commandError("typing", reason),
            typing: false,
          });
        });
      }, typingIdleMilliseconds);
      return;
    }
    if (typingActive) await context.sdk.chat.setTyping(false);
    typingActive = false;
    publish({ ...state, typing: false });
  };

  const execute = async <T>(
    command: SpaceChatCommand,
    effect: () => Promise<T>,
    onSuccess?: (value: T) => void,
  ): Promise<T | undefined> => {
    if (disposed || state.pending) return undefined;
    publish({ ...state, pending: command, error: null });
    try {
      const value = await effect();
      if (!disposed) {
        publish({ ...state, pending: null, error: null });
        onSuccess?.(value);
      }
      return value;
    } catch (reason) {
      if (!disposed) publish({
        ...state,
        pending: null,
        error: commandError(command, reason),
      });
      return undefined;
    }
  };

  const timelineUnsubscribe = timeline.subscribe(() => {
    const snapshot = timeline.getSnapshot();
    publish({
      ...state,
      messages: snapshot.messages,
      typingUsers: snapshot.typingUsers,
      ready: snapshot.ready,
      disposed: snapshot.disposed,
    });
  });

  const controller: SpaceChatController = {
    ready: timeline.ready.then(() => {
      if (!disposed) publish({
        ...state,
        ...timeline.getSnapshot(),
        disposed: false,
      });
    }),
    get disposed() {
      return disposed;
    },
    getSnapshot() {
      return state;
    },
    subscribe(listener) {
      if (typeof listener !== "function") {
        throw new TypeError("Space Chat listener must be a function");
      }
      if (disposed) return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setDraft(value, mentionIds) {
      if (disposed) return;
      const draft = String(value ?? "");
      publish({
        ...state,
        draft,
        mentionIds: Object.freeze(draft.trim()
          ? [...new Set(mentionIds ?? state.mentionIds)]
          : []),
      });
    },
    beginReply(value) {
      if (disposed) return;
      const message = resolveContextMessage(state.messages, value);
      if (!message || message.deleted) return;
      publish({
        ...state,
        context: Object.freeze({ kind: "reply", message }),
      });
    },
    beginEdit(value) {
      if (disposed) return;
      const message = resolveContextMessage(state.messages, value);
      if (!message || !message.isOwn || message.deleted) return;
      publish({
        ...state,
        draft: message.text,
        mentionIds: Object.freeze([]),
        context: Object.freeze({ kind: "edit", message }),
      });
    },
    cancelContext() {
      if (disposed || !state.context) return;
      publish({
        ...state,
        draft: state.context.kind === "edit" ? "" : state.draft,
        mentionIds: state.context.kind === "edit" ? Object.freeze([]) : state.mentionIds,
        context: null,
      });
    },
    searchMentions(query = "") {
      if (disposed) return Object.freeze([]);
      const targets = Object.freeze([...context.sdk.mention.search(query)]);
      publish({ ...state, mentionTargets: targets });
      return targets;
    },
    selectMention(target) {
      if (disposed || !target?.id || target.available === false) return;
      const known = context.sdk.mention.search("")
        .some((candidate) => candidate.id === target.id);
      if (!known) return;
      publish({
        ...state,
        mentionIds: Object.freeze([...new Set([...state.mentionIds, target.id])]),
      });
    },
    async send() {
      const text = state.draft.trim();
      if (!text) return undefined;
      const activeContext = state.context;
      let completed = false;
      const result = await execute(
        activeContext?.kind === "edit" ? "edit" : "send",
        () => activeContext?.kind === "edit"
          ? context.sdk.chat.edit(activeContext.message.id, text)
          : context.sdk.chat.send({
              text,
              replyToId: activeContext?.kind === "reply"
                ? activeContext.message.id
                : undefined,
              mentionIds: state.mentionIds.length > 0
                ? [...state.mentionIds]
                : undefined,
            }),
        () => { completed = true; },
      );
      if (completed && !disposed) {
        publish({
          ...state,
          draft: "",
          mentionIds: Object.freeze([]),
          mentionTargets: Object.freeze([]),
          context: null,
        });
        await setTypingEffect(false).catch((reason) => {
          if (!disposed) publish({ ...state, error: commandError("typing", reason) });
        });
      }
      return result;
    },
    attach(file) {
      if (!file || typeof file.name !== "string") {
        return Promise.resolve(undefined);
      }
      return execute("attach", () => context.sdk.chat.attach(file));
    },
    edit(messageId, text) {
      const value = text.trim();
      if (!messageId || !value) return Promise.resolve(undefined);
      return execute("edit", () => context.sdk.chat.edit(messageId, value));
    },
    delete(messageId) {
      if (!messageId) return Promise.resolve(undefined);
      return execute("delete", () => context.sdk.chat.delete(messageId));
    },
    toggleReaction(messageId, emoji) {
      if (!messageId || !emoji.trim()) return Promise.resolve(undefined);
      return execute(
        "reaction",
        () => context.sdk.chat.toggleReaction(messageId, emoji),
      );
    },
    retry(messageId) {
      if (!messageId) return Promise.resolve(undefined);
      return execute("retry", () => context.sdk.chat.retry(messageId));
    },
    async setTyping(isTyping) {
      if (disposed) return;
      try {
        await setTypingEffect(Boolean(isTyping));
      } catch (reason) {
        if (!disposed) publish({ ...state, error: commandError("typing", reason) });
      }
    },
    markRead() {
      return execute("mark-read", () => context.sdk.chat.markRead());
    },
    clearError() {
      if (!disposed && state.error) publish({ ...state, error: null });
    },
    dispose() {
      if (disposed) return;
      stopTypingTimer();
      if (typingActive) {
        typingActive = false;
        try {
          void context.sdk.chat.setTyping(false).catch((reason) => {
            context.logger.warn("Space Chat typing cleanup failed", {
              reason: reason instanceof Error ? reason.message : String(reason),
            });
          });
        } catch (reason) {
          context.logger.warn("Space Chat typing cleanup failed", {
            reason: reason instanceof Error ? reason.message : String(reason),
          });
        }
      }
      disposed = true;
      removeFromContext();
      timelineUnsubscribe();
      timeline.dispose();
      state = Object.freeze({ ...state, disposed: true, typing: false });
      for (const listener of listeners) listener();
      listeners.clear();
    },
  };

  if (!disposed) {
    removeFromContext = context.addDisposable(() => controller.dispose());
  }
  return controller;
}
