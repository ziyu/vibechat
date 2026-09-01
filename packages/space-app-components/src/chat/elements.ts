import { createSpaceComponentTranslator } from "../core/context.js";
import {
  defineSpaceAgentElements,
  spaceAgentAvatarElementName,
  spaceAgentBadgeElementName,
  type SpaceAgentAvatarElement,
} from "../agent/elements.js";
import {
  defineSpaceElements as defineSpaceAvatarElement,
  spaceAvatarElementName,
  type SpaceAvatarStatus,
} from "../foundation/avatar.js";
import { defineSpaceElement, type SpaceElementRegistry } from "../foundation/element.js";
import {
  escapeSpaceAttribute,
  sanitizeSpaceMediaUrl,
} from "../foundation/safety.js";
import type { SpaceAgentIdentityView } from "../agent/view.js";
import type {
  SpaceChatAuthorView,
  SpaceChatMessageView,
  SpaceChatReactionView,
  SpaceChatReplyState,
  SpaceChatReplyView,
} from "./view.js";
import {
  emitSpaceChatAuthorCardEvent,
  spaceChatAuthorCardEventNames,
} from "./author-card.js";
import { defineSpaceChatInteractiveElements } from "./interactive-elements.js";

export const spaceChatMessageMetaElementName = "vc-space-chat-message-meta" as const;
export const spaceReplyPreviewElementName = "vc-space-reply-preview" as const;
export const spaceChatBubbleElementName = "vc-space-chat-bubble" as const;
export const spaceChatMessageElementName = "vc-space-chat-message" as const;
export const spaceTypingIndicatorElementName = "vc-space-typing-indicator" as const;

export interface SpaceChatMessageMetaElement extends HTMLElement {
  message: SpaceChatMessageView | null;
}

export interface SpaceReplyPreviewElement extends HTMLElement {
  reply: SpaceChatReplyView | null;
}

export interface SpaceChatBubbleElement extends HTMLElement {
  message: SpaceChatMessageView | null;
}

export interface SpaceChatMessageElement extends HTMLElement {
  message: SpaceChatMessageView | null;
  groupPosition: SpaceChatMessageGroupPosition;
  showReactions: boolean;
}

export type SpaceChatMessageGroupPosition = "single" | "first" | "middle" | "last";

export interface SpaceTypingIndicatorElement extends HTMLElement {
  users: readonly SpaceChatAuthorView[];
}

const messageAttributes = [
  "agent",
  "author-avatar",
  "author-handle",
  "author-id",
  "author-kind",
  "author-name",
  "author-presence",
  "agent-active-count",
  "agent-pending-count",
  "agent-status",
  "agent-summary",
  "created-at",
  "deleted",
  "edited",
  "has-attachment",
  "locale",
  "message-id",
  "own",
  "reactions",
  "reply-author",
  "reply-author-id",
  "reply-author-kind",
  "reply-id",
  "reply-state",
  "reply-text",
  "room-id",
  "status",
  "text",
] as const;

function messageGroupPosition(value: string | null): SpaceChatMessageGroupPosition {
  return value === "first" || value === "middle" || value === "last"
    ? value
    : "single";
}

function documentLocale(element: HTMLElement) {
  return element.getAttribute("locale")
    || element.ownerDocument.documentElement.lang
    || "en";
}

function messageStatus(value: string | null): SpaceChatMessageView["status"] {
  return value === "sending" || value === "failed" ? value : "sent";
}

function authorKind(value: string | null): SpaceChatAuthorView["kind"] {
  return value === "agent" ? "agent" : "member";
}

function authorPresence(value: string | null): SpaceAvatarStatus {
  return value === "online" || value === "away" || value === "none"
    ? value
    : "offline";
}

function authorCount(value: string | null) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

function replyState(value: string | null): SpaceChatReplyState {
  return value === "deleted" || value === "missing" ? value : "available";
}

function authorFromAttributes(element: HTMLElement): SpaceChatAuthorView {
  return {
    id: element.getAttribute("author-id") || "",
    kind: authorKind(element.getAttribute("author-kind")),
    name: element.getAttribute("author-name")?.trim() || "Member",
    handle: element.getAttribute("author-handle")?.trim() || null,
    avatarUrl: sanitizeSpaceMediaUrl(element.getAttribute("author-avatar")),
    isSelf: element.hasAttribute("own"),
    presence: authorPresence(element.getAttribute("author-presence")),
    agentStatus: element.getAttribute("agent-status") as SpaceChatAuthorView["agentStatus"],
    agentSummary: element.getAttribute("agent-summary")?.trim() || null,
    agentActiveCount: authorCount(element.getAttribute("agent-active-count")),
    agentPendingCount: authorCount(element.getAttribute("agent-pending-count")),
  };
}

function reactionViewsFromAttribute(value: string | null) {
  if (!value) return Object.freeze([]) as readonly SpaceChatReactionView[];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return Object.freeze([]);
    return Object.freeze(parsed.flatMap((item): SpaceChatReactionView[] => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const candidate = item as Record<string, unknown>;
      if (typeof candidate.emoji !== "string") return [];
      return [{
        emoji: candidate.emoji,
        count: Number.isFinite(candidate.count)
          ? Math.max(0, Math.floor(Number(candidate.count)))
          : 0,
        reactedBySelf: candidate.reactedBySelf === true,
      }];
    }));
  } catch {
    return Object.freeze([]);
  }
}

function replyFromAttributes(element: HTMLElement): SpaceChatReplyView | null {
  const messageId = element.getAttribute("reply-id");
  if (!messageId) return null;
  const state = replyState(element.getAttribute("reply-state"));
  const authorId = element.getAttribute("reply-author-id");
  const authorName = element.getAttribute("reply-author");
  return {
    messageId,
    state,
    author: authorId || authorName
      ? {
          id: authorId || "",
          kind: authorKind(element.getAttribute("reply-author-kind")),
          name: authorName?.trim() || "Member",
          handle: null,
          avatarUrl: null,
          isSelf: false,
        }
      : null,
    text: state === "available"
      ? element.getAttribute("reply-text") || ""
      : "",
  };
}

function messageFromAttributes(element: HTMLElement): SpaceChatMessageView {
  const author = authorFromAttributes(element);
  const deleted = element.hasAttribute("deleted");
  return {
    id: element.getAttribute("message-id") || "",
    roomId: element.getAttribute("room-id") || "",
    author,
    text: deleted ? "" : element.getAttribute("text") || "",
    createdAt: element.getAttribute("created-at") || "",
    status: messageStatus(element.getAttribute("status")),
    isOwn: element.hasAttribute("own"),
    isAgent: element.hasAttribute("agent") || author.kind === "agent",
    edited: !deleted && element.hasAttribute("edited"),
    deleted,
    reply: replyFromAttributes(element),
    reactions: reactionViewsFromAttribute(element.getAttribute("reactions")),
    actions: {
      reply: false,
      edit: false,
      delete: false,
      retry: false,
      react: false,
    },
    hasAttachment: element.hasAttribute("has-attachment"),
  };
}

function formatMessageTime(value: string, locale: string) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.valueOf())) return null;
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }
}

function setMessageProperty<T extends HTMLElement & { message: SpaceChatMessageView | null }>(
  element: T,
  message: SpaceChatMessageView,
) {
  element.message = message;
  return element;
}

export const spaceChatMessageMetaStyles = `
:host {
  display: block;
  min-inline-size: 0;
  color: var(--vc-space-chat-bubble-muted, var(--vc-space-color-text-muted, #5d6670));
  font-family: var(--vc-space-font-body, sans-serif);
}
.meta {
  display: flex;
  min-inline-size: 0;
  flex-wrap: wrap;
  align-items: baseline;
  gap: .25rem .58rem;
  font-size: var(--vc-space-text-caption-size, .76rem);
  line-height: 1.35;
}
.author {
  display: inline-flex;
  align-items: center;
  min-inline-size: 0;
  min-block-size: 1.75rem;
  margin: -.22rem -.32rem;
  padding: .22rem .32rem;
  border: 0;
  border-radius: var(--vc-space-radius-control, .55rem);
  color: var(--vc-space-color-text, #172026);
  background: transparent;
  font-family: inherit;
  font-size: .82rem;
  font-weight: 780;
  line-height: 1.25;
  text-align: inherit;
  overflow-wrap: anywhere;
  cursor: pointer;
}
.author:hover { background: color-mix(in srgb, currentColor 9%, transparent); }
.author:focus-visible { outline: 3px solid var(--vc-space-color-focus, #2366d1); outline-offset: 2px; }
.time, .state { font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.state[data-status="failed"] { color: var(--vc-space-color-negative, #a33b43); font-weight: 760; }
.state[data-status="sending"] { font-style: italic; }
@media (forced-colors: active), (prefers-contrast: more) {
  :host, .author, .state[data-status] { color: CanvasText; }
  .author { border: 1px solid ButtonText; background: ButtonFace; }
  .author:hover { background: Highlight; color: HighlightText; }
  .state[data-status="failed"] { text-decoration: underline; }
}
@media (pointer: coarse) {
  .meta { min-block-size: 2.75rem; align-items: center; }
  .author { min-block-size: 2.75rem; margin-block: -.6rem; }
}
@media (prefers-reduced-motion: reduce) {
  .author { scroll-behavior: auto; }
}
`;

function createSpaceChatMessageMetaElementClass() {
  return class VcSpaceChatMessageMetaElement extends HTMLElement implements SpaceChatMessageMetaElement {
    static readonly observedAttributes = [...messageAttributes, "group-position"];
    #message: SpaceChatMessageView | null = null;

    get message() { return this.#message; }
    set message(value) {
      this.#message = value;
      if (this.isConnected) this.render();
    }

    connectedCallback() {
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      this.render();
    }

    attributeChangedCallback(name: string) {
      if (this.isConnected && (name === "group-position" || !this.#message)) {
        this.render();
      }
    }

    private render() {
      const root = this.shadowRoot;
      if (!root) return;
      const message = this.#message ?? messageFromAttributes(this);
      const locale = documentLocale(this);
      const translate = createSpaceComponentTranslator(locale);
      const formattedTime = formatMessageTime(message.createdAt, locale);
      const groupPosition = messageGroupPosition(this.getAttribute("group-position"));
      const showHeader = groupPosition === "single" || groupPosition === "first";
      const showDelivery = message.isOwn && (
        groupPosition === "single"
        || groupPosition === "last"
        || message.status !== "sent"
      );
      const style = this.ownerDocument.createElement("style");
      style.textContent = spaceChatMessageMetaStyles;
      const meta = this.ownerDocument.createElement("div");
      meta.className = "meta";
      meta.setAttribute("part", "meta");
      if (showHeader) {
        const author = this.ownerDocument.createElement("button");
        author.type = "button";
        author.className = "author";
        author.setAttribute("part", "author");
        author.setAttribute("data-testid", "chat-author-trigger");
        author.setAttribute("aria-haspopup", "dialog");
        author.setAttribute("aria-expanded", "false");
        author.setAttribute(
          "aria-label",
          translate("space.components.chat.author.card.open", {
            author: message.author.name,
          }),
        );
        author.textContent = message.author.name;
        author.addEventListener("pointerenter", (event) => {
          if (event.pointerType !== "touch") {
            emitSpaceChatAuthorCardEvent(
              author,
              spaceChatAuthorCardEventNames.preview,
              message.author,
            );
          }
        });
        author.addEventListener("pointerleave", (event) => {
          if (event.pointerType !== "touch") {
            emitSpaceChatAuthorCardEvent(
              author,
              spaceChatAuthorCardEventNames.dismiss,
              message.author,
            );
          }
        });
        author.addEventListener("focus", () => {
          emitSpaceChatAuthorCardEvent(
            author,
            spaceChatAuthorCardEventNames.preview,
            message.author,
          );
        });
        author.addEventListener("blur", () => {
          emitSpaceChatAuthorCardEvent(
            author,
            spaceChatAuthorCardEventNames.dismiss,
            message.author,
          );
        });
        author.addEventListener("click", () => {
          emitSpaceChatAuthorCardEvent(
            author,
            spaceChatAuthorCardEventNames.toggle,
            message.author,
          );
        });
        meta.append(author);
        if (message.isAgent) {
          const badge = this.ownerDocument.createElement(spaceAgentBadgeElementName);
          badge.setAttribute("part", "agent-badge");
          meta.append(badge);
        }
        const time = this.ownerDocument.createElement("time");
        time.className = "time";
        time.setAttribute("part", "time");
        if (formattedTime) time.dateTime = message.createdAt;
        time.textContent = formattedTime
          || translate("space.components.chat.time.unknown");
        meta.append(time);
      }
      const states = [
        message.edited ? translate("space.components.chat.edited") : "",
        showDelivery
          ? translate(`space.components.chat.delivery.${message.status}`)
          : "",
      ].filter(Boolean);
      if (states.length > 0) {
        const state = this.ownerDocument.createElement("span");
        state.className = "state";
        state.dataset.status = message.status;
        state.setAttribute("part", "state");
        state.setAttribute("data-testid", "delivery-status");
        state.textContent = states.join(" · ");
        meta.append(state);
      }
      root.replaceChildren(style, meta);
    }
  };
}

export const spaceReplyPreviewStyles = `
:host {
  display: block;
  min-inline-size: 0;
  color: var(--vc-space-color-text-muted, #5d6670);
  font-family: var(--vc-space-font-body, sans-serif);
}
.preview {
  display: grid;
  min-inline-size: 0;
  gap: .12rem;
  margin: 0 0 .56rem;
  padding: .42rem .58rem;
  border-inline-start: .2rem solid var(--vc-space-color-accent, #d95835);
  border-radius: .18rem var(--vc-space-radius-control, .55rem) var(--vc-space-radius-control, .55rem) .18rem;
  background: color-mix(in srgb, var(--vc-space-color-surface, #f5f2eb) 72%, transparent);
  font-size: var(--vc-space-text-caption-size, .76rem);
  line-height: 1.36;
}
.author { color: var(--vc-space-chat-bubble-text, var(--vc-space-color-text, #172026)); overflow-wrap: anywhere; }
.text { min-inline-size: 0; overflow-wrap: anywhere; }
.preview[data-state="missing"] .text { font-style: italic; }
@media (forced-colors: active), (prefers-contrast: more) {
  .preview { border: 1px solid CanvasText; border-inline-start-width: .25rem; background: Canvas; color: CanvasText; }
  .author { color: CanvasText; }
}
`;

function createSpaceReplyPreviewElementClass() {
  return class VcSpaceReplyPreviewElement extends HTMLElement implements SpaceReplyPreviewElement {
    static readonly observedAttributes = [
      "locale",
      "reply-author",
      "reply-author-id",
      "reply-author-kind",
      "reply-id",
      "reply-state",
      "reply-text",
    ];
    #reply: SpaceChatReplyView | null = null;

    get reply() { return this.#reply; }
    set reply(value) {
      this.#reply = value;
      if (this.isConnected) this.render();
    }

    connectedCallback() {
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      this.render();
    }

    attributeChangedCallback() {
      if (this.isConnected && !this.#reply) this.render();
    }

    private render() {
      const root = this.shadowRoot;
      if (!root) return;
      const reply = this.#reply ?? replyFromAttributes(this);
      const translate = createSpaceComponentTranslator(documentLocale(this));
      const style = this.ownerDocument.createElement("style");
      style.textContent = spaceReplyPreviewStyles;
      if (!reply) {
        root.replaceChildren(style);
        return;
      }
      const preview = this.ownerDocument.createElement("blockquote");
      preview.className = "preview";
      preview.dataset.state = reply.state;
      preview.setAttribute("part", "preview");
      preview.setAttribute(
        "aria-label",
        reply.author
          ? translate("space.components.chat.reply.label", {
              author: reply.author.name,
            })
          : translate("space.components.chat.reply.missing"),
      );
      if (reply.author) {
        const author = this.ownerDocument.createElement("strong");
        author.className = "author";
        author.setAttribute("part", "author");
        author.textContent = reply.author.name;
        preview.append(author);
      }
      const text = this.ownerDocument.createElement("span");
      text.className = "text";
      text.setAttribute("part", "text");
      text.textContent = reply.state === "available"
        ? reply.text
        : translate(`space.components.chat.reply.${reply.state}`);
      preview.append(text);
      root.replaceChildren(style, preview);
    }
  };
}

export const spaceChatBubbleStyles = `
:host {
  display: block;
  min-inline-size: 0;
  color: var(--vc-space-chat-bubble-text, var(--vc-space-color-text, #172026));
  font-family: var(--vc-space-font-body, sans-serif);
}
.bubble {
  min-inline-size: 0;
  padding: var(--vc-space-chat-bubble-padding, .72rem .82rem);
  border: 1px solid var(--vc-space-color-border, #8a929a);
  border-radius: var(--vc-space-chat-bubble-radius, var(--vc-space-radius-card, .9rem));
  border-start-start-radius: var(--vc-space-chat-bubble-group-start-radius);
  border-start-end-radius: var(--vc-space-chat-bubble-group-start-radius);
  border-end-start-radius: var(--vc-space-chat-bubble-group-end-radius);
  border-end-end-radius: var(--vc-space-chat-bubble-group-end-radius);
  background: var(--vc-space-chat-bubble-background, var(--vc-space-color-surface-raised, #fff));
}
.body { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.48; }
.body[hidden], .attachment[hidden] { display: none; }
.attachment {
  display: block;
  margin-block-end: .48rem;
  color: var(--vc-space-chat-bubble-muted, var(--vc-space-color-text-muted, #5d6670));
  font-size: var(--vc-space-text-caption-size, .76rem);
  font-weight: 700;
}
.bubble[data-deleted="true"] .body { color: var(--vc-space-chat-bubble-muted, var(--vc-space-color-text-muted, #5d6670)); font-style: italic; }
@media (forced-colors: active), (prefers-contrast: more) {
  .bubble { border: 2px solid CanvasText; color: CanvasText; background: Canvas; }
  .attachment, .bubble[data-deleted="true"] .body { color: CanvasText; }
}
`;

function createSpaceChatBubbleElementClass() {
  return class VcSpaceChatBubbleElement extends HTMLElement implements SpaceChatBubbleElement {
    static readonly observedAttributes = messageAttributes;
    #message: SpaceChatMessageView | null = null;

    get message() { return this.#message; }
    set message(value) {
      this.#message = value;
      if (this.isConnected) this.render();
    }

    connectedCallback() {
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      this.render();
    }

    attributeChangedCallback() {
      if (this.isConnected && !this.#message) this.render();
    }

    private render() {
      const root = this.shadowRoot;
      if (!root) return;
      const message = this.#message ?? messageFromAttributes(this);
      const translate = createSpaceComponentTranslator(documentLocale(this));
      const style = this.ownerDocument.createElement("style");
      style.textContent = spaceChatBubbleStyles;
      const bubble = this.ownerDocument.createElement("div");
      bubble.className = "bubble";
      bubble.dataset.deleted = String(message.deleted);
      bubble.dataset.status = message.status;
      bubble.setAttribute("part", "bubble");
      if (message.reply) {
        const reply = this.ownerDocument.createElement(spaceReplyPreviewElementName) as SpaceReplyPreviewElement;
        reply.setAttribute("part", "reply");
        reply.reply = message.reply;
        bubble.append(reply);
      }
      const attachment = this.ownerDocument.createElement("span");
      attachment.className = "attachment";
      attachment.hidden = !message.hasAttachment;
      attachment.setAttribute("part", "attachment-state");
      attachment.textContent = translate("space.components.chat.attachment");
      const body = this.ownerDocument.createElement("p");
      body.className = "body";
      body.setAttribute("part", "body");
      body.setAttribute("data-testid", "message-body");
      body.hidden = !message.deleted && message.text.length === 0;
      body.textContent = message.deleted
        ? translate("space.components.chat.deleted")
        : message.text;
      bubble.append(attachment, body);
      root.replaceChildren(style, bubble);
    }
  };
}

export const spaceChatMessageStyles = `
:host {
  display: block;
  min-inline-size: 0;
  color: var(--vc-space-color-text, #172026);
  font-family: var(--vc-space-font-body, sans-serif);
}
.message {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: .62rem;
  align-items: end;
  min-inline-size: 0;
}
.message[data-own="true"] { grid-template-columns: minmax(0, 1fr); padding-inline-start: min(16%, 7rem); }
.message[data-own="false"] { padding-inline-end: min(10%, 5rem); }
.message[data-group="middle"], .message[data-group="last"] { align-items: start; }
.avatar { align-self: end; margin-block-end: .18rem; }
.content { display: grid; min-inline-size: 0; gap: .3rem; }
.message[data-group="middle"] .content,
.message[data-group="last"] .content { gap: 0; }
.message[data-own="true"] .content { justify-items: end; }
.message[data-own="true"] ${spaceChatMessageMetaElementName} { text-align: end; }
.message[data-own="true"] ${spaceChatBubbleElementName} {
  --vc-space-chat-bubble-background: var(--vc-space-color-accent, #d95835);
  --vc-space-chat-bubble-text: var(--vc-space-color-accent-contrast, #fff);
  --vc-space-chat-bubble-muted: var(--vc-space-color-accent-contrast, #fff);
  max-inline-size: 100%;
}
.message[data-agent="true"] ${spaceChatBubbleElementName} {
  --vc-space-chat-bubble-background: color-mix(in srgb, var(--vc-space-color-accent, #d95835) 12%, var(--vc-space-color-surface-raised, #fff));
}
.message[data-group="first"] ${spaceChatBubbleElementName},
.message[data-group="middle"] ${spaceChatBubbleElementName} {
  --vc-space-chat-bubble-group-end-radius: .42rem;
}
.message[data-group="middle"] ${spaceChatBubbleElementName},
.message[data-group="last"] ${spaceChatBubbleElementName} {
  --vc-space-chat-bubble-group-start-radius: .42rem;
}
.message[data-status="failed"] ${spaceChatBubbleElementName} {
  --vc-space-chat-bubble-background: color-mix(in srgb, var(--vc-space-color-negative, #a33b43) 8%, var(--vc-space-color-surface-raised, #fff));
  --vc-space-chat-bubble-text: var(--vc-space-color-text, #172026);
  --vc-space-chat-bubble-muted: var(--vc-space-color-text-muted, #5d6670);
}
.reactions {
  display: flex;
  min-inline-size: 0;
  flex-wrap: wrap;
  gap: .35rem;
}
.reaction {
  display: inline-flex;
  gap: .28rem;
  align-items: center;
  min-inline-size: 0;
  padding: .18rem .45rem;
  border: 1px solid var(--vc-space-color-border, #8a929a);
  border-radius: 999px;
  color: var(--vc-space-color-text-muted, #5d6670);
  background: var(--vc-space-color-surface, #f5f2eb);
  font-size: var(--vc-space-text-caption-size, .75rem);
  line-height: 1.2;
  overflow-wrap: anywhere;
}
.reaction[data-reacted="true"] { border-width: 2px; color: var(--vc-space-color-text, #172026); font-weight: 760; }
@media (max-width: 24rem) {
  .message[data-own="true"] { padding-inline-start: 8%; }
  .message[data-own="false"] { padding-inline-end: 3%; }
}
@media (forced-colors: active), (prefers-contrast: more) {
  .reaction, .reaction[data-reacted="true"] { border: 2px solid CanvasText; color: CanvasText; background: Canvas; }
  .reaction[data-reacted="true"] { outline: 1px solid CanvasText; }
}
`;

function avatarForMessage(
  element: HTMLElement,
  message: SpaceChatMessageView,
) {
  if (message.isAgent) {
    const avatar = element.ownerDocument.createElement(spaceAgentAvatarElementName) as SpaceAgentAvatarElement;
    const agent: SpaceAgentIdentityView = {
      id: message.author.id,
      name: message.author.name,
      avatarUrl: message.author.avatarUrl,
      status: "idle",
      summary: null,
      activeCount: 0,
      pendingCount: 0,
    };
    avatar.agent = agent;
    avatar.setAttribute("size", "sm");
    return avatar;
  }
  const avatar = element.ownerDocument.createElement(spaceAvatarElementName);
  avatar.setAttribute("name", message.author.name);
  avatar.setAttribute("size", "sm");
  avatar.setAttribute("status", "none");
  if (message.author.avatarUrl) avatar.setAttribute("src", message.author.avatarUrl);
  return avatar;
}

function createSpaceChatMessageElementClass() {
  return class VcSpaceChatMessageElement extends HTMLElement implements SpaceChatMessageElement {
    static readonly observedAttributes = [
      ...messageAttributes,
      "group-position",
      "hide-reactions",
    ];
    #message: SpaceChatMessageView | null = null;

    get message() { return this.#message; }
    set message(value) {
      this.#message = value;
      if (this.isConnected) this.render();
    }
    get showReactions() { return !this.hasAttribute("hide-reactions"); }
    set showReactions(value) {
      this.toggleAttribute("hide-reactions", !value);
    }
    get groupPosition() {
      return messageGroupPosition(this.getAttribute("group-position"));
    }
    set groupPosition(value) {
      this.setAttribute("group-position", messageGroupPosition(value));
    }

    connectedCallback() {
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      this.render();
    }

    attributeChangedCallback(name: string) {
      if (this.isConnected && (name === "group-position" || !this.#message)) {
        this.render();
      }
    }

    private render() {
      const root = this.shadowRoot;
      if (!root) return;
      const message = this.#message ?? messageFromAttributes(this);
      const translate = createSpaceComponentTranslator(documentLocale(this));
      const style = this.ownerDocument.createElement("style");
      style.textContent = spaceChatMessageStyles;
      const article = this.ownerDocument.createElement("article");
      article.className = "message";
      article.dataset.own = String(message.isOwn);
      article.dataset.agent = String(message.isAgent);
      article.dataset.group = this.groupPosition;
      article.dataset.status = message.status;
      article.setAttribute("data-testid", "chat-message");
      article.setAttribute("part", "message");
      article.setAttribute(
        "aria-label",
        translate("space.components.chat.message.label", {
          author: message.author.name,
        }),
      );
      if (
        !message.isOwn
        && (this.groupPosition === "single" || this.groupPosition === "last")
      ) {
        const avatar = avatarForMessage(this, message);
        avatar.className = "avatar";
        avatar.setAttribute("part", "avatar");
        avatar.setAttribute(
          "label",
          translate("space.components.chat.author.avatar", {
            author: message.author.name,
          }),
        );
        article.append(avatar);
      }
      const content = this.ownerDocument.createElement("div");
      content.className = "content";
      content.setAttribute("part", "content");
      const meta = setMessageProperty(
        this.ownerDocument.createElement(spaceChatMessageMetaElementName) as SpaceChatMessageMetaElement,
        message,
      );
      meta.setAttribute("part", "meta");
      meta.setAttribute(
        "exportparts",
        "meta:message-meta,author:author-trigger,agent-badge:author-agent-badge,time:message-time,state:message-state",
      );
      meta.setAttribute("group-position", this.groupPosition);
      const bubble = setMessageProperty(
        this.ownerDocument.createElement(spaceChatBubbleElementName) as SpaceChatBubbleElement,
        message,
      );
      content.append(meta, bubble);
      if (this.showReactions && message.reactions.length > 0) {
        const reactions = this.ownerDocument.createElement("div");
        reactions.className = "reactions";
        reactions.setAttribute("part", "reactions");
        reactions.setAttribute(
          "aria-label",
          translate("space.components.chat.reactions.label"),
        );
        for (const reaction of message.reactions) {
          const item = this.ownerDocument.createElement("span");
          item.className = "reaction";
          item.dataset.reacted = String(reaction.reactedBySelf);
          item.setAttribute("part", "reaction");
          item.setAttribute(
            "aria-label",
            translate("space.components.chat.reaction.label", {
              emoji: reaction.emoji,
              count: reaction.count,
            }),
          );
          item.textContent = `${reaction.emoji} ${reaction.count}`;
          reactions.append(item);
        }
        content.append(reactions);
      }
      article.append(content);
      root.replaceChildren(style, article);
    }
  };
}

export const spaceTypingIndicatorStyles = `
:host {
  display: block;
  min-inline-size: 0;
  color: var(--vc-space-color-text-muted, #5d6670);
  font-family: var(--vc-space-font-body, sans-serif);
}
.status {
  display: inline-flex;
  min-inline-size: 0;
  align-items: center;
  gap: .48rem;
  font-size: var(--vc-space-text-caption-size, .78rem);
  line-height: 1.35;
}
.status[hidden] { display: none; }
.signal { display: inline-flex; gap: .18rem; flex: none; }
.dot { inline-size: .3rem; block-size: .3rem; border-radius: 50%; background: currentColor; opacity: .72; }
.text { min-inline-size: 0; overflow-wrap: anywhere; }
@media (prefers-reduced-motion: no-preference) {
  .dot { animation: vc-space-typing 1.15s ease-in-out infinite alternate; }
  .dot:nth-child(2) { animation-delay: 160ms; }
  .dot:nth-child(3) { animation-delay: 320ms; }
}
@keyframes vc-space-typing { to { opacity: .25; transform: translateY(-.12rem); } }
@media (forced-colors: active), (prefers-contrast: more) {
  :host { color: CanvasText; }
  .dot { border: 1px solid CanvasText; background: CanvasText; }
}
`;

function typingUsersFromAttribute(value: string | null) {
  if (!value) return Object.freeze([]) as readonly SpaceChatAuthorView[];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return Object.freeze([]);
    return Object.freeze(parsed.flatMap((item): SpaceChatAuthorView[] => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const candidate = item as Record<string, unknown>;
      if (typeof candidate.name !== "string") return [];
      return [{
        id: typeof candidate.id === "string" ? candidate.id : "",
        kind: candidate.kind === "agent" ? "agent" : "member",
        name: candidate.name.trim() || "Member",
        handle: typeof candidate.handle === "string" ? candidate.handle : null,
        avatarUrl: null,
        isSelf: candidate.isSelf === true,
      }];
    }));
  } catch {
    return Object.freeze([]);
  }
}

function formatTypingNames(users: readonly SpaceChatAuthorView[], locale: string) {
  const names = users.map((user) => user.name);
  try {
    return new Intl.ListFormat(locale, {
      style: "long",
      type: "conjunction",
    }).format(names);
  } catch {
    return names.join(", ");
  }
}

function createSpaceTypingIndicatorElementClass() {
  return class VcSpaceTypingIndicatorElement extends HTMLElement implements SpaceTypingIndicatorElement {
    static readonly observedAttributes = ["locale", "users"];
    #users: readonly SpaceChatAuthorView[] | null = null;

    get users() { return this.#users ?? []; }
    set users(value) {
      this.#users = Object.freeze([...(value ?? [])]);
      if (this.isConnected) this.render();
    }

    connectedCallback() {
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      this.setAttribute("role", "status");
      this.setAttribute("aria-live", "polite");
      this.render();
    }

    attributeChangedCallback() {
      if (this.isConnected && !this.#users) this.render();
    }

    private render() {
      const root = this.shadowRoot;
      if (!root) return;
      const users = this.#users ?? typingUsersFromAttribute(this.getAttribute("users"));
      const locale = documentLocale(this);
      const translate = createSpaceComponentTranslator(locale);
      const style = this.ownerDocument.createElement("style");
      style.textContent = spaceTypingIndicatorStyles;
      const status = this.ownerDocument.createElement("span");
      status.className = "status";
      status.hidden = users.length === 0;
      status.setAttribute("part", "status");
      const signal = this.ownerDocument.createElement("span");
      signal.className = "signal";
      signal.setAttribute("part", "signal");
      signal.setAttribute("aria-hidden", "true");
      for (let index = 0; index < 3; index += 1) {
        const dot = this.ownerDocument.createElement("span");
        dot.className = "dot";
        signal.append(dot);
      }
      const copy = this.ownerDocument.createElement("span");
      copy.className = "text";
      copy.setAttribute("part", "text");
      copy.textContent = translate(
        users.length === 1
          ? "space.components.chat.typing.one"
          : "space.components.chat.typing.many",
        { names: formatTypingNames(users, locale) },
      );
      status.append(signal, copy);
      root.replaceChildren(style, status);
    }
  };
}

function appendAttribute(
  attributes: string[],
  name: string,
  value: string | number | null | undefined,
) {
  if (value === null || value === undefined || value === "") return;
  attributes.push(`${name}="${escapeSpaceAttribute(String(value))}"`);
}

export function renderSpaceChatMessage(message: SpaceChatMessageView) {
  const attributes: string[] = [];
  appendAttribute(attributes, "message-id", message.id);
  appendAttribute(attributes, "room-id", message.roomId);
  appendAttribute(attributes, "author-id", message.author.id);
  appendAttribute(attributes, "author-kind", message.author.kind);
  appendAttribute(attributes, "author-name", message.author.name);
  appendAttribute(attributes, "author-handle", message.author.handle);
  appendAttribute(attributes, "author-presence", message.author.presence);
  appendAttribute(attributes, "agent-status", message.author.agentStatus);
  appendAttribute(attributes, "agent-summary", message.author.agentSummary);
  appendAttribute(attributes, "agent-active-count", message.author.agentActiveCount);
  appendAttribute(attributes, "agent-pending-count", message.author.agentPendingCount);
  appendAttribute(
    attributes,
    "author-avatar",
    sanitizeSpaceMediaUrl(message.author.avatarUrl),
  );
  appendAttribute(attributes, "created-at", message.createdAt);
  appendAttribute(attributes, "status", message.status);
  appendAttribute(attributes, "text", message.text);
  if (message.isOwn) attributes.push("own");
  if (message.isAgent) attributes.push("agent");
  if (message.edited) attributes.push("edited");
  if (message.deleted) attributes.push("deleted");
  if (message.hasAttachment) attributes.push("has-attachment");
  if (message.reply) {
    appendAttribute(attributes, "reply-id", message.reply.messageId);
    appendAttribute(attributes, "reply-state", message.reply.state);
    appendAttribute(attributes, "reply-author-id", message.reply.author?.id);
    appendAttribute(attributes, "reply-author-kind", message.reply.author?.kind);
    appendAttribute(attributes, "reply-author", message.reply.author?.name);
    appendAttribute(attributes, "reply-text", message.reply.text);
  }
  if (message.reactions.length > 0) {
    appendAttribute(attributes, "reactions", JSON.stringify(message.reactions));
  }
  return `<${spaceChatMessageElementName} ${attributes.join(" ")}></${spaceChatMessageElementName}>`;
}

export function renderSpaceTypingIndicator(
  users: readonly SpaceChatAuthorView[],
) {
  const serialized = users.map((user) => ({
    id: user.id,
    kind: user.kind,
    name: user.name,
    handle: user.handle,
    isSelf: user.isSelf,
  }));
  return `<${spaceTypingIndicatorElementName} users="${escapeSpaceAttribute(JSON.stringify(serialized))}"></${spaceTypingIndicatorElementName}>`;
}

export function defineSpaceChatElements(
  registry: SpaceElementRegistry | undefined = globalThis.customElements,
) {
  if (!registry || typeof globalThis.HTMLElement !== "function") return false;
  defineSpaceAvatarElement(registry);
  defineSpaceAgentElements(registry);
  defineSpaceElement(registry, spaceChatMessageMetaElementName, createSpaceChatMessageMetaElementClass);
  defineSpaceElement(registry, spaceReplyPreviewElementName, createSpaceReplyPreviewElementClass);
  defineSpaceElement(registry, spaceChatBubbleElementName, createSpaceChatBubbleElementClass);
  defineSpaceElement(registry, spaceChatMessageElementName, createSpaceChatMessageElementClass);
  defineSpaceElement(registry, spaceTypingIndicatorElementName, createSpaceTypingIndicatorElementClass);
  defineSpaceChatInteractiveElements(registry);
  return true;
}
