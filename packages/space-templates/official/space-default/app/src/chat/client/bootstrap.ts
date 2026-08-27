import type {
  SpaceMentionTarget,
  SpaceSdk,
} from "../../browser/sdk.js";
import { getChatCopy } from "./copy.js";

interface SpaceChatAuthorView {
  readonly id: string;
  readonly name: string;
}

interface SpaceChatReactionView {
  readonly emoji: string;
  readonly count: number;
  readonly reactedBySelf: boolean;
}

interface SpaceChatMessageView {
  readonly id: string;
  readonly text: string;
  readonly status: "sending" | "sent" | "failed";
  readonly isOwn: boolean;
  readonly isAgent: boolean;
  readonly deleted: boolean;
  readonly author: SpaceChatAuthorView;
  readonly reactions: readonly SpaceChatReactionView[];
}

interface SpaceChatSnapshot {
  readonly messages: readonly SpaceChatMessageView[];
  readonly typingUsers: readonly SpaceChatAuthorView[];
  readonly ready: boolean;
  readonly draft: string;
  readonly mentionIds: readonly string[];
  readonly mentionTargets: readonly SpaceMentionTarget[];
  readonly context: {
    readonly kind: "reply" | "edit";
    readonly message: SpaceChatMessageView;
  } | null;
  readonly pending: string | null;
  readonly error: { readonly command: string; readonly message: string } | null;
}

interface SpaceChatController {
  readonly ready: Promise<void>;
  getSnapshot(): SpaceChatSnapshot;
  subscribe(listener: () => void): () => void;
  setDraft(value: string, mentionIds?: readonly string[]): void;
  beginReply(messageId: string): void;
  beginEdit(messageId: string): void;
  cancelContext(): void;
  searchMentions(query?: string): readonly SpaceMentionTarget[];
  selectMention(target: SpaceMentionTarget): void;
  send(): Promise<unknown>;
  attach(file: File): Promise<unknown>;
  delete(messageId: string): Promise<unknown>;
  toggleReaction(messageId: string, emoji: string): Promise<unknown>;
  retry(messageId: string): Promise<unknown>;
  setTyping(isTyping: boolean): Promise<void>;
  markRead(): Promise<unknown>;
  clearError(): void;
  dispose(): void;
}

interface SpaceChatTimelineElement extends HTMLElement {
  messages: readonly SpaceChatMessageView[];
  typingUsers: readonly SpaceChatAuthorView[];
  state: "loading" | "ready" | "error";
  error: string | null;
}

interface SpaceChatComposerElement extends HTMLElement {
  draft: string;
  mentionIds: readonly string[];
  context: {
    readonly kind: "reply" | "edit";
    readonly messageId: string;
    readonly author: string;
    readonly text: string;
  } | null;
  pending: boolean;
  insertMention(
    target: SpaceMentionTarget,
    range?: { readonly start: number; readonly end: number } | null,
  ): void;
}

interface SpaceMentionMenuElement extends HTMLElement {
  targets: readonly SpaceMentionTarget[];
}

interface SpaceErrorElement extends HTMLElement {
  error: { readonly command: string; readonly message: string } | null;
}

interface SpaceMessageActionsElement extends HTMLElement {
  actions: {
    readonly messageId: string;
    readonly canReply: boolean;
    readonly canEdit: boolean;
    readonly canDelete: boolean;
    readonly canRetry: boolean;
    readonly disabled: boolean;
  } | null;
}

interface SpaceReactionBarElement extends HTMLElement {
  messageId: string;
  reactions: readonly SpaceChatReactionView[];
  disabled: boolean;
}

interface SpaceChatComponentModule {
  createSpaceComponentContext(options: { sdk: SpaceSdk }): {
    dispose(): void;
  };
  createSpaceChatController(context: unknown): SpaceChatController;
  spaceChatEventNames: Readonly<Record<string, string>>;
}

export async function bootstrapChat(
  space: SpaceSdk,
  components: SpaceChatComponentModule,
  mode: "full" | "dock",
) {
  const requireElement = <T extends Element>(selector: string) => {
    const element = document.querySelector<T>(selector);
    if (!element) throw new Error(`Default Chat App is missing ${selector}`);
    return element;
  };
  const eventDetail = <T>(event: Event) => (event as CustomEvent<T>).detail;
  const root = requireElement<HTMLElement>("#vcc-root");
  const launch = requireElement<HTMLButtonElement>("#vcc-launch");
  const close = requireElement<HTMLButtonElement>("#vcc-close");
  const unread = requireElement<HTMLElement>("#vcc-unread");
  const mark = requireElement<HTMLElement>("#vcc-mark");
  const roomName = requireElement<HTMLElement>("#vcc-room-name");
  const memberCount = requireElement<HTMLElement>("#vcc-member-count");
  const opening = requireElement<HTMLElement>("#vcc-opening");
  const openingMark = requireElement<HTMLElement>("#vcc-opening-mark");
  const openingTitle = requireElement<HTMLElement>("#vcc-opening-title");
  const openingSummary = requireElement<HTMLElement>("#vcc-opening-summary");
  const openingAgent = requireElement<HTMLElement>("#vcc-opening-agent");
  const build = requireElement<HTMLElement>("#vcc-build");
  const buildTitle = requireElement<HTMLElement>("#vcc-build-title");
  const buildStage = requireElement<HTMLElement>("#vcc-build-stage");
  const hint = requireElement<HTMLElement>("#vcc-hint");
  const timeline = requireElement<SpaceChatTimelineElement>("#vcc-timeline");
  const composer = requireElement<SpaceChatComposerElement>("#vcc-composer");
  const mentions = requireElement<SpaceMentionMenuElement>("#vcc-mentions");
  const error = requireElement<SpaceErrorElement>("#vcc-error");
  const context = components.createSpaceComponentContext({ sdk: space });
  const chat = components.createSpaceChatController(context);
  const events = components.spaceChatEventNames;
  let mentionRange: { readonly start: number; readonly end: number } | null = null;
  let renderedDraft: string | null = null;
  let renderedMentionIds = "";
  let renderedMessages: readonly SpaceChatMessageView[] | null = null;
  let renderedTypingUsers: readonly SpaceChatAuthorView[] | null = null;
  let controlsMessages: readonly SpaceChatMessageView[] | null = null;
  let controlsPending: string | null = null;
  let lastMessageCount = chat.getSnapshot().messages.length;

  root.dataset.mode = mode;
  root.dataset.open = String(mode === "full");

  const updateMessageControls = (state: SpaceChatSnapshot) => {
    const timelineRoot = timeline.shadowRoot;
    if (!timelineRoot) return;
    if (!timelineRoot.querySelector("[data-vcc-template-controls]")) {
      const style = document.createElement("style");
      style.dataset.vccTemplateControls = "true";
      style.textContent = `
        .vcc-entry-controls {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-inline-start: 42px;
        }
        .vcc-entry-controls[data-own="true"] {
          justify-content: flex-end;
          margin-inline: 0;
        }
        .vcc-entry-controls vc-space-message-actions,
        .vcc-entry-controls vc-space-reaction-bar {
          display: block;
        }
        .vcc-entry-controls vc-space-message-actions::part(actions),
        .vcc-entry-controls vc-space-reaction-bar::part(bar) {
          gap: 4px;
        }
        .vcc-entry-controls vc-space-message-actions::part(reply),
        .vcc-entry-controls vc-space-message-actions::part(edit),
        .vcc-entry-controls vc-space-message-actions::part(delete),
        .vcc-entry-controls vc-space-message-actions::part(retry),
        .vcc-entry-controls vc-space-reaction-bar::part(reaction) {
          min-block-size: 44px;
          min-inline-size: 44px;
          padding: 7px 10px;
          border-radius: 8px;
          font-size: 10px;
        }
        @media (max-width: 390px) {
          .vcc-entry-controls { margin-inline-start: 0; }
        }
      `;
      timelineRoot.append(style);
    }
    const reactionChoices = ["♥", "✨", "🌙"];
    for (const message of state.messages) {
      const entry = timelineRoot.querySelector<HTMLElement>(
        `[data-message-id="${CSS.escape(message.id)}"]`,
      );
      if (!entry) continue;
      let controls = entry.querySelector<HTMLElement>(".vcc-entry-controls");
      if (!controls) {
        controls = document.createElement("div");
        controls.className = "vcc-entry-controls";
        entry.append(controls);
      }
      controls.dataset.own = String(message.isOwn);
      let actions = controls.querySelector<SpaceMessageActionsElement>(
        "vc-space-message-actions",
      );
      if (!actions) {
        actions = document.createElement(
          "vc-space-message-actions",
        ) as SpaceMessageActionsElement;
        controls.append(actions);
      }
      actions.actions = message.deleted || message.isAgent
        ? null
        : {
            messageId: message.id,
            canReply: true,
            canEdit: message.isOwn,
            canDelete: message.isOwn,
            canRetry: message.isOwn && message.status === "failed",
            disabled: state.pending !== null,
          };
      let reactions = controls.querySelector<SpaceReactionBarElement>(
        "vc-space-reaction-bar",
      );
      if (!reactions) {
        reactions = document.createElement(
          "vc-space-reaction-bar",
        ) as SpaceReactionBarElement;
        controls.append(reactions);
      }
      const reactionByEmoji = new Map(
        message.reactions.map((reaction) => [reaction.emoji, reaction]),
      );
      for (const emoji of reactionChoices) {
        if (!reactionByEmoji.has(emoji)) {
          reactionByEmoji.set(emoji, {
            emoji,
            count: 0,
            reactedBySelf: false,
          });
        }
      }
      reactions.messageId = message.id;
      reactions.reactions = message.deleted
        ? []
        : [...reactionByEmoji.values()];
      reactions.disabled = state.pending !== null;
    }
  };

  const render = () => {
    const state = chat.getSnapshot();
    const snapshot = space.snapshot;
    const copy = getChatCopy(space);
    const locale = space.locale || snapshot.locale || "en";
    document.documentElement.lang = locale;
    for (const element of [timeline, composer, mentions, error]) {
      element.setAttribute("locale", locale);
    }
    mark.textContent = snapshot.meta.icon || "V";
    roomName.textContent = snapshot.meta.name || "Space";
    memberCount.textContent =
      `${snapshot.members.length} ${copy.members} · ${copy.connected}`;
    openingMark.textContent = snapshot.meta.icon || "V";
    openingTitle.textContent = snapshot.meta.name || "Space";
    openingSummary.textContent = snapshot.meta.summary || copy.empty;
    openingAgent.textContent =
      `Matrix Chat Core · @${snapshot.agent.id || "agent"}`;
    hint.textContent = copy.hint;
    opening.hidden = state.messages.length > 0;

    const buildSnapshot = snapshot.agent.build;
    build.hidden = !buildSnapshot;
    buildTitle.textContent = buildSnapshot
      ? `${snapshot.agent.name || snapshot.agent.id || "Agent"} ${copy.working}`
      : "";
    buildStage.textContent = buildSnapshot && typeof buildSnapshot.stage === "string"
      ? buildSnapshot.stage
      : "";

    timeline.state = state.error && !state.ready
      ? "error"
      : state.ready
        ? "ready"
        : "loading";
    timeline.error = state.error && !state.ready ? state.error.message : null;
    if (renderedMessages !== state.messages) {
      renderedMessages = state.messages;
      timeline.messages = state.messages;
    }
    if (renderedTypingUsers !== state.typingUsers) {
      renderedTypingUsers = state.typingUsers;
      timeline.typingUsers = state.typingUsers;
    }
    if (renderedDraft !== state.draft) {
      renderedDraft = state.draft;
      composer.draft = state.draft;
    }
    const mentionIds = state.mentionIds.join("\u0000");
    if (renderedMentionIds !== mentionIds) {
      renderedMentionIds = mentionIds;
      composer.mentionIds = state.mentionIds;
    }
    composer.pending = state.pending !== null;
    composer.context = state.context
      ? {
          kind: state.context.kind,
          messageId: state.context.message.id,
          author: state.context.message.author.name,
          text: state.context.message.text,
        }
      : null;
    mentions.targets = state.mentionTargets;
    error.error = state.error;

    if (
      controlsMessages !== state.messages
      || controlsPending !== state.pending
    ) {
      controlsMessages = state.messages;
      controlsPending = state.pending;
      updateMessageControls(state);
    }
    if (root.dataset.open !== "true" && state.messages.length > lastMessageCount) {
      unread.textContent = String(state.messages.length - lastMessageCount);
    } else if (root.dataset.open === "true") {
      unread.textContent = "0";
    }
    lastMessageCount = state.messages.length;
  };

  launch.addEventListener("click", () => {
    root.dataset.open = "true";
    unread.textContent = "0";
    void chat.markRead();
  });
  close.addEventListener("click", () => {
    root.dataset.open = "false";
  });
  composer.addEventListener(events.submit, (event) => {
    const detail = eventDetail<{
      text: string;
      mentionIds: readonly string[];
    }>(event);
    chat.setDraft(detail.text, detail.mentionIds);
    void chat.send();
  });
  composer.addEventListener(events.attach, (event) => {
    void chat.attach(eventDetail<{ file: File }>(event).file);
  });
  composer.addEventListener(events.typing, (event) => {
    void chat.setTyping(
      eventDetail<{ isTyping: boolean }>(event).isTyping,
    );
  });
  composer.addEventListener(events.mentionQuery, (event) => {
    const detail = eventDetail<{
      query: string | null;
      range: { readonly start: number; readonly end: number } | null;
    }>(event);
    mentionRange = detail.range;
    mentions.hidden = detail.query === null;
    if (detail.query !== null) chat.searchMentions(detail.query);
  });
  composer.addEventListener(events.cancelContext, () => {
    chat.cancelContext();
  });
  mentions.addEventListener(events.mentionSelect, (event) => {
    const target = eventDetail<{ target: SpaceMentionTarget }>(event).target;
    chat.selectMention(target);
    composer.insertMention(target, mentionRange);
    mentionRange = null;
    mentions.hidden = true;
  });
  mentions.addEventListener(events.mentionDismiss, () => {
    mentionRange = null;
    mentions.hidden = true;
  });
  timeline.addEventListener(events.reply, (event) => {
    chat.beginReply(eventDetail<{ messageId: string }>(event).messageId);
  });
  timeline.addEventListener(events.edit, (event) => {
    chat.beginEdit(eventDetail<{ messageId: string }>(event).messageId);
  });
  timeline.addEventListener(events.delete, (event) => {
    void chat.delete(eventDetail<{ messageId: string }>(event).messageId);
  });
  timeline.addEventListener(events.retry, (event) => {
    void chat.retry(eventDetail<{ messageId: string }>(event).messageId);
  });
  timeline.addEventListener(events.reaction, (event) => {
    const detail = eventDetail<{ messageId: string; emoji: string }>(event);
    void chat.toggleReaction(detail.messageId, detail.emoji);
  });
  error.addEventListener(events.dismissError, () => {
    chat.clearError();
  });

  const unsubscribe = chat.subscribe(render);
  await chat.ready;
  render();
  void chat.markRead();
  window.addEventListener("pagehide", () => {
    unsubscribe();
    chat.dispose();
    context.dispose();
  }, { once: true });
}
