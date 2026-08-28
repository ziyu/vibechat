import type { SpaceMentionTarget } from "@vibechat/space-app-sdk";
import { createSpaceComponentTranslator } from "../core/context.js";
import { defineSpaceElement, type SpaceElementRegistry } from "../foundation/element.js";
import {
  defineSpaceMentionTargetItemElement,
  spaceMentionTargetItemElementName,
  type SpaceMentionTargetItemElement,
} from "../user/mention-elements.js";
import {
  escapeSpaceAttribute,
  sanitizeSpaceMediaUrl,
} from "../foundation/safety.js";
import type {
  SpaceChatCommand,
  SpaceChatCommandError,
} from "./controller.js";
import type {
  SpaceChatAttachmentView,
  SpaceChatActionAvailability,
  SpaceChatAuthorView,
  SpaceChatMessageView,
  SpaceChatReactionView,
} from "./view.js";
import type { SpaceChatMessageGroupPosition } from "./elements.js";

export const spaceChatTimelineElementName = "vc-space-chat-timeline" as const;
export const spaceChatComposerElementName = "vc-space-chat-composer" as const;
export const spaceMentionMenuElementName = "vc-space-mention-menu" as const;
export const spaceChatAttachmentElementName = "vc-space-chat-attachment" as const;
export const spaceReactionBarElementName = "vc-space-reaction-bar" as const;
export const spaceMessageActionsElementName = "vc-space-message-actions" as const;
export const spaceChatErrorStateElementName = "vc-space-chat-error-state" as const;

export const spaceChatEventNames = Object.freeze({
  submit: "vc-space-chat-submit",
  attach: "vc-space-chat-attach",
  typing: "vc-space-chat-typing",
  mentionQuery: "vc-space-mention-query",
  mentionSelect: "vc-space-mention-select",
  mentionDismiss: "vc-space-mention-dismiss",
  cancelContext: "vc-space-chat-cancel-context",
  reply: "vc-space-chat-reply",
  edit: "vc-space-chat-edit",
  delete: "vc-space-chat-delete",
  retry: "vc-space-chat-retry",
  reaction: "vc-space-chat-reaction",
  dismissError: "vc-space-chat-dismiss-error",
} as const);

export interface SpaceMentionRange {
  readonly start: number;
  readonly end: number;
}

export interface SpaceChatComponentEventDetailMap {
  [spaceChatEventNames.submit]: { text: string; mentionIds: readonly string[] };
  [spaceChatEventNames.attach]: { file: File };
  [spaceChatEventNames.typing]: { isTyping: boolean };
  [spaceChatEventNames.mentionQuery]: {
    query: string | null;
    range: SpaceMentionRange | null;
  };
  [spaceChatEventNames.mentionSelect]: { target: SpaceMentionTarget };
  [spaceChatEventNames.mentionDismiss]: Record<string, never>;
  [spaceChatEventNames.cancelContext]: Record<string, never>;
  [spaceChatEventNames.reply]: { messageId: string };
  [spaceChatEventNames.edit]: { messageId: string };
  [spaceChatEventNames.delete]: { messageId: string };
  [spaceChatEventNames.retry]: { messageId: string };
  [spaceChatEventNames.reaction]: { messageId: string; emoji: string };
  [spaceChatEventNames.dismissError]: { command: SpaceChatCommand };
}

export type SpaceChatComponentEventName = keyof SpaceChatComponentEventDetailMap;
export type SpaceChatComponentEvent<Name extends SpaceChatComponentEventName> =
  CustomEvent<SpaceChatComponentEventDetailMap[Name]>;

export interface SpaceChatComposerContext {
  readonly kind: "reply" | "edit";
  readonly messageId: string;
  readonly author: string;
  readonly text: string;
}

export interface SpaceMessageActionsView {
  readonly messageId: string;
  readonly canReply: boolean;
  readonly canEdit: boolean;
  readonly canDelete: boolean;
  readonly canRetry: boolean;
  readonly disabled?: boolean;
}

export type SpaceChatTimelineState = "loading" | "ready" | "error";

export interface SpaceChatTimelineElement extends HTMLElement {
  messages: readonly SpaceChatMessageView[];
  typingUsers: readonly SpaceChatAuthorView[];
  state: SpaceChatTimelineState;
  error: string | null;
  interactive: boolean;
  interactionDisabled: boolean;
  reactionChoices: readonly string[];
}

export interface SpaceChatComposerElement extends HTMLElement {
  draft: string;
  mentionIds: readonly string[];
  context: SpaceChatComposerContext | null;
  disabled: boolean;
  sendDisabled: boolean;
  attachmentDisabled: boolean;
  pending: boolean;
  insertMention(target: SpaceMentionTarget, range?: SpaceMentionRange | null): void;
  focus(): void;
}

export interface SpaceMentionMenuElement extends HTMLElement {
  targets: readonly SpaceMentionTarget[];
  focusFirst(): void;
}

export interface SpaceChatAttachmentElement extends HTMLElement {
  attachment: SpaceChatAttachmentView | null;
}

export interface SpaceReactionBarElement extends HTMLElement {
  messageId: string;
  reactions: readonly SpaceChatReactionView[];
  disabled: boolean;
}

export interface SpaceMessageActionsElement extends HTMLElement {
  actions: SpaceMessageActionsView | null;
  compact: boolean;
  reactionChoices: readonly string[];
}

export interface SpaceChatErrorStateElement extends HTMLElement {
  error: SpaceChatCommandError | null;
}

function localeFor(element: HTMLElement) {
  return element.getAttribute("locale")
    || element.ownerDocument.documentElement.lang
    || "en";
}

function emit<Name extends SpaceChatComponentEventName>(
  element: HTMLElement,
  name: Name,
  detail: SpaceChatComponentEventDetailMap[Name],
) {
  return element.dispatchEvent(new CustomEvent(name, {
    bubbles: true,
    composed: true,
    detail,
  }));
}

function mentionRange(value: string, caret = value.length): SpaceMentionRange | null {
  const prefix = value.slice(0, Math.max(0, caret));
  const match = prefix.match(/(?:^|\s)@([^\s@]*)$/);
  if (!match) return null;
  const marker = prefix.lastIndexOf("@");
  return marker < 0 ? null : { start: marker, end: caret };
}

function queryAt(value: string, range: SpaceMentionRange | null) {
  return range ? value.slice(range.start + 1, range.end) : null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const spaceChatComposerStyles = `
:host { display:block; min-inline-size:0; color:var(--vc-space-color-text,#172026); font-family:var(--vc-space-font-body,sans-serif); }
.context { display:flex; align-items:center; justify-content:space-between; gap:.75rem; margin-block-end:.45rem; padding:.48rem .62rem; border-inline-start:.2rem solid var(--vc-space-color-accent,#d95835); border-radius:var(--vc-space-radius-control,.55rem); color:var(--vc-space-color-text-muted,#5d6670); background:var(--vc-space-color-surface,#f5f2eb); font-size:var(--vc-space-text-caption-size,.76rem); }
.context[hidden] { display:none; }
.context-copy { min-inline-size:0; overflow-wrap:anywhere; }
.context button,.attach,.send { min-inline-size:2.75rem; min-block-size:2.75rem; border:1px solid var(--vc-space-color-border,#8a929a); border-radius:var(--vc-space-radius-control,.65rem); color:inherit; background:var(--vc-space-color-surface-raised,#fff); font:700 .78rem/1 var(--vc-space-font-body,sans-serif); cursor:pointer; }
form { display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:end; gap:.45rem; padding:.45rem; border:1px solid var(--vc-space-color-border,#8a929a); border-radius:var(--vc-space-chat-composer-radius,1rem); background:var(--vc-space-color-surface-raised,#fff); }
textarea { box-sizing:border-box; inline-size:100%; min-inline-size:0; min-block-size:2.75rem; max-block-size:8rem; resize:none; overflow-y:auto; padding:.7rem .35rem .48rem; border:0; outline:0; color:inherit; background:transparent; font:inherit; line-height:1.45; }
textarea::placeholder { color:var(--vc-space-color-text-muted,#5d6670); }
.send { border-color:var(--vc-space-color-accent,#d95835); color:var(--vc-space-color-accent-contrast,#fff); background:var(--vc-space-color-accent,#d95835); }
button:disabled,textarea:disabled { cursor:not-allowed; opacity:.55; }
button:focus-visible,textarea:focus-visible { outline:3px solid var(--vc-space-color-focus,#2366d1); outline-offset:2px; }
@media (max-width:24rem) { form { gap:.25rem; padding:.35rem; } .attach,.send { min-inline-size:2.75rem; padding-inline:.4rem; } }
@media (forced-colors:active),(prefers-contrast:more) { form,.context,.context button,.attach,.send { border:2px solid CanvasText; background:Canvas; color:CanvasText; } }
`;

function createSpaceChatComposerElementClass() {
  return class VcSpaceChatComposerElement extends HTMLElement implements SpaceChatComposerElement {
    static readonly observedAttributes = [
      "attachment-disabled",
      "disabled",
      "locale",
      "maxlength",
      "pending",
      "placeholder",
      "send-disabled",
    ];
    #draft = "";
    #mentionIds: string[] = [];
    #mentionHandles = new Map<string, string>();
    #context: SpaceChatComposerContext | null = null;
    #composing = false;
    #textarea: HTMLTextAreaElement | null = null;
    #send: HTMLButtonElement | null = null;
    #contextNode: HTMLElement | null = null;

    get draft() { return this.#draft; }
    set draft(value) {
      this.#draft = String(value ?? "");
      if (this.#textarea && this.#textarea.value !== this.#draft) {
        this.#textarea.value = this.#draft;
      }
      this.resize();
      this.syncDisabled();
    }
    get mentionIds() { return Object.freeze([...this.#mentionIds]); }
    set mentionIds(value) {
      this.#mentionIds = [...new Set(value ?? [])];
    }
    get context() { return this.#context; }
    set context(value) {
      this.#context = value;
      this.renderContext();
    }
    get disabled() { return this.hasAttribute("disabled"); }
    set disabled(value) { this.toggleAttribute("disabled", Boolean(value)); }
    get sendDisabled() { return this.hasAttribute("send-disabled"); }
    set sendDisabled(value) {
      this.toggleAttribute("send-disabled", Boolean(value));
    }
    get attachmentDisabled() { return this.hasAttribute("attachment-disabled"); }
    set attachmentDisabled(value) {
      this.toggleAttribute("attachment-disabled", Boolean(value));
    }
    get pending() { return this.hasAttribute("pending"); }
    set pending(value) { this.toggleAttribute("pending", Boolean(value)); }

    connectedCallback() {
      if (!this.shadowRoot) this.build();
      this.syncAttributes();
      this.renderContext();
    }

    attributeChangedCallback() {
      if (this.isConnected) this.syncAttributes();
    }

    focus() { this.#textarea?.focus(); }

    insertMention(target: SpaceMentionTarget, range?: SpaceMentionRange | null) {
      if (!target?.id || !target.handle || target.available === false) return;
      const textarea = this.#textarea;
      const resolved = range ?? mentionRange(
        this.#draft,
        textarea?.selectionStart ?? this.#draft.length,
      );
      if (!resolved) return;
      const replacement = `@${target.handle} `;
      this.#draft = `${this.#draft.slice(0, resolved.start)}${replacement}${this.#draft.slice(resolved.end)}`;
      this.#mentionIds = [...new Set([...this.#mentionIds, target.id])];
      this.#mentionHandles.set(target.id, target.handle);
      if (textarea) {
        textarea.value = this.#draft;
        const caret = resolved.start + replacement.length;
        textarea.setSelectionRange(caret, caret);
        textarea.focus();
      }
      this.resize();
      this.syncDisabled();
      emit(this, spaceChatEventNames.mentionQuery, { query: null, range: null });
    }

    private build() {
      const root = this.attachShadow({ mode: "open" });
      const style = this.ownerDocument.createElement("style");
      style.textContent = spaceChatComposerStyles;
      const context = this.ownerDocument.createElement("div");
      context.className = "context";
      context.hidden = true;
      context.setAttribute("part", "context");
      context.setAttribute("data-testid", "chat-context");
      const contextCopy = this.ownerDocument.createElement("span");
      contextCopy.className = "context-copy";
      contextCopy.setAttribute("part", "context-copy");
      const cancel = this.ownerDocument.createElement("button");
      cancel.type = "button";
      cancel.setAttribute("part", "cancel-context");
      cancel.addEventListener("click", () => emit(
        this,
        spaceChatEventNames.cancelContext,
        {},
      ));
      context.append(contextCopy, cancel);
      const form = this.ownerDocument.createElement("form");
      form.setAttribute("part", "form");
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        this.submit();
      });
      const attach = this.ownerDocument.createElement("button");
      attach.className = "attach";
      attach.type = "button";
      attach.setAttribute("part", "attach");
      const file = this.ownerDocument.createElement("input");
      file.type = "file";
      file.hidden = true;
      file.tabIndex = -1;
      file.setAttribute("data-testid", "attachment-input");
      attach.addEventListener("click", () => file.click());
      file.addEventListener("change", () => {
        const selected = file.files?.[0];
        if (selected) emit(this, spaceChatEventNames.attach, { file: selected });
        file.value = "";
      });
      const textarea = this.ownerDocument.createElement("textarea");
      textarea.rows = 1;
      textarea.setAttribute("part", "input");
      textarea.setAttribute("data-testid", "message-input");
      textarea.addEventListener("compositionstart", () => { this.#composing = true; });
      textarea.addEventListener("compositionend", () => { this.#composing = false; });
      textarea.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey && !event.isComposing && !this.#composing) {
          event.preventDefault();
          this.submit();
        }
      });
      textarea.addEventListener("input", () => {
        this.#draft = textarea.value;
        for (const [id, handle] of this.#mentionHandles) {
          const token = new RegExp(`(^|\\s)@${escapeRegExp(handle)}(?=\\s|$)`, "i");
          if (!token.test(this.#draft)) {
            this.#mentionHandles.delete(id);
            this.#mentionIds = this.#mentionIds.filter((value) => value !== id);
          }
        }
        this.resize();
        this.syncDisabled();
        emit(this, spaceChatEventNames.typing, {
          isTyping: Boolean(this.#draft.trim()),
        });
        const range = mentionRange(this.#draft, textarea.selectionStart);
        emit(this, spaceChatEventNames.mentionQuery, {
          query: queryAt(this.#draft, range),
          range,
        });
      });
      const send = this.ownerDocument.createElement("button");
      send.className = "send";
      send.type = "submit";
      send.setAttribute("part", "send");
      send.setAttribute("data-testid", "send-message");
      form.append(attach, file, textarea, send);
      root.replaceChildren(style, context, form);
      this.#textarea = textarea;
      this.#send = send;
      this.#contextNode = context;
    }

    private submit() {
      const text = this.#draft.trim();
      if (!text || this.disabled || this.sendDisabled || this.pending) return;
      emit(this, spaceChatEventNames.submit, {
        text,
        mentionIds: Object.freeze([...this.#mentionIds]),
      });
      emit(this, spaceChatEventNames.typing, { isTyping: false });
    }

    private resize() {
      const textarea = this.#textarea;
      if (!textarea) return;
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
    }

    private syncAttributes() {
      const translate = createSpaceComponentTranslator(localeFor(this));
      const textarea = this.#textarea;
      const send = this.#send;
      const attach = this.shadowRoot?.querySelector<HTMLButtonElement>(".attach");
      const file = this.shadowRoot?.querySelector<HTMLInputElement>("input[type=file]");
      if (textarea) {
        textarea.disabled = this.disabled || this.sendDisabled;
        textarea.maxLength = Math.max(1, Number(this.getAttribute("maxlength")) || 4000);
        textarea.placeholder = this.getAttribute("placeholder")
          || translate("space.components.chat.composer.placeholder");
        textarea.setAttribute("aria-label", textarea.placeholder);
      }
      if (attach) {
        attach.disabled = this.disabled || this.attachmentDisabled || this.pending;
        attach.textContent = translate("space.components.chat.composer.attach");
        attach.setAttribute("aria-label", translate("space.components.chat.composer.attach"));
      }
      if (file) file.disabled = this.disabled || this.attachmentDisabled || this.pending;
      if (send) {
        send.textContent = this.pending
          ? translate("space.components.chat.composer.pending")
          : translate("space.components.chat.composer.send");
        send.setAttribute("aria-label", send.textContent);
      }
      this.syncDisabled();
    }

    private syncDisabled() {
      if (this.#send) {
        this.#send.disabled = this.disabled
          || this.sendDisabled
          || this.pending
          || !this.#draft.trim();
      }
    }

    private renderContext() {
      const container = this.#contextNode;
      if (!container) return;
      const copy = container.querySelector<HTMLElement>(".context-copy");
      const cancel = container.querySelector<HTMLButtonElement>("button");
      const translate = createSpaceComponentTranslator(localeFor(this));
      container.hidden = !this.#context;
      if (copy && this.#context) {
        copy.textContent = translate(
          `space.components.chat.context.${this.#context.kind}`,
          { author: this.#context.author, text: this.#context.text },
        );
      }
      if (cancel) {
        cancel.textContent = translate("space.components.chat.context.cancel");
        cancel.setAttribute("aria-label", cancel.textContent);
      }
    }
  };
}

export const spaceMentionMenuStyles = `
:host { display:block; min-inline-size:0; color:var(--vc-space-color-text,#172026); font-family:var(--vc-space-font-body,sans-serif); }
.menu { display:grid; max-block-size:13rem; overflow:auto; gap:.18rem; padding:.35rem; border:1px solid var(--vc-space-color-border,#8a929a); border-radius:var(--vc-space-radius-card,.9rem); background:var(--vc-space-color-surface-raised,#fff); box-shadow:0 .8rem 2.2rem color-mix(in srgb,var(--vc-space-color-text,#172026) 18%,transparent); }
.menu[hidden] { display:none; }
button { display:block; inline-size:100%; min-inline-size:0; min-block-size:44px; padding:.55rem .7rem; border:1px solid transparent; border-radius:var(--vc-space-radius-control,.55rem); color:inherit; background:transparent; text-align:start; cursor:pointer; }
button:hover,button:focus-visible { border-color:var(--vc-space-color-accent,#d95835); outline:2px solid transparent; background:var(--vc-space-color-surface,#f5f2eb); }
button:disabled { cursor:not-allowed; opacity:.55; }
@media (forced-colors:active),(prefers-contrast:more) { .menu,button:focus-visible { border:2px solid CanvasText; background:Canvas; color:CanvasText; } }
`;

function createSpaceMentionMenuElementClass() {
  return class VcSpaceMentionMenuElement extends HTMLElement implements SpaceMentionMenuElement {
    static readonly observedAttributes = ["locale"];
    #targets: readonly SpaceMentionTarget[] = Object.freeze([]);
    get targets() { return this.#targets; }
    set targets(value) {
      this.#targets = Object.freeze([...(value ?? [])]);
      if (this.isConnected) this.render();
    }
    connectedCallback() {
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      this.render();
    }
    attributeChangedCallback() {
      if (this.isConnected) this.render();
    }
    focusFirst() {
      this.shadowRoot?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    }
    private render() {
      const root = this.shadowRoot;
      if (!root) return;
      const translate = createSpaceComponentTranslator(localeFor(this));
      const style = this.ownerDocument.createElement("style");
      style.textContent = spaceMentionMenuStyles;
      const menu = this.ownerDocument.createElement("div");
      menu.className = "menu";
      menu.hidden = this.targets.length === 0;
      menu.setAttribute("part", "menu");
      menu.setAttribute("role", "listbox");
      menu.setAttribute("aria-label", translate("space.components.chat.mention.label"));
      const focusAt = (current: HTMLButtonElement, offset: number) => {
        const buttons = Array.from(
          menu.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
        );
        const index = Math.max(0, buttons.indexOf(current));
        buttons[(index + offset + buttons.length) % buttons.length]?.focus();
      };
      for (const target of this.targets) {
        const button = this.ownerDocument.createElement("button");
        button.type = "button";
        button.disabled = target.available === false;
        button.setAttribute("role", "option");
        button.setAttribute("part", "option");
        const targetItem = this.ownerDocument.createElement(
          spaceMentionTargetItemElementName,
        ) as SpaceMentionTargetItemElement;
        targetItem.target = target;
        targetItem.setAttribute("part", "target");
        button.append(targetItem);
        const select = () => emit(this, spaceChatEventNames.mentionSelect, { target });
        button.addEventListener("click", select);
        button.addEventListener("keydown", (event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            focusAt(button, event.key === "ArrowDown" ? 1 : -1);
          } else if (event.key === "Home" || event.key === "End") {
            event.preventDefault();
            const buttons = Array.from(
              menu.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
            );
            buttons[event.key === "Home" ? 0 : buttons.length - 1]?.focus();
          } else if (event.key === "Escape") {
            event.preventDefault();
            emit(this, spaceChatEventNames.mentionDismiss, {});
          }
        });
        menu.append(button);
      }
      root.replaceChildren(style, menu);
    }
  };
}

function attachmentFromAttributes(element: HTMLElement): SpaceChatAttachmentView | null {
  const name = element.getAttribute("name")?.trim();
  if (!name) return null;
  const kind = element.getAttribute("kind") === "image" ? "image" : "file";
  const rawSize = Number(element.getAttribute("size"));
  return {
    name,
    kind,
    mediaType: element.getAttribute("media-type")?.trim() || null,
    size: Number.isFinite(rawSize) && rawSize >= 0 ? Math.floor(rawSize) : null,
    downloadUrl: sanitizeSpaceMediaUrl(element.getAttribute("download-url")),
    previewUrl: kind === "image"
      ? sanitizeSpaceMediaUrl(element.getAttribute("preview-url"))
      : null,
  };
}

function formatBytes(size: number | null, locale: string) {
  if (size === null) return null;
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: index ? 1 : 0 }).format(value)} ${units[index]}`;
}

export const spaceChatAttachmentStyles = `
:host { display:block; min-inline-size:0; color:var(--vc-space-color-text,#172026); font-family:var(--vc-space-font-body,sans-serif); }
.attachment { display:grid; grid-template-columns:auto minmax(0,1fr); align-items:center; gap:.7rem; min-block-size:2.75rem; padding:.55rem .65rem; border:1px solid var(--vc-space-color-border,#8a929a); border-radius:var(--vc-space-radius-control,.65rem); color:inherit; background:var(--vc-space-color-surface,#f5f2eb); text-decoration:none; }
.preview { inline-size:4rem; block-size:3.25rem; border-radius:.45rem; object-fit:cover; background:var(--vc-space-color-surface-raised,#fff); }
.mark { display:grid; inline-size:2.75rem; block-size:2.75rem; place-items:center; border:1px solid var(--vc-space-color-border,#8a929a); border-radius:.45rem; font-weight:800; }
.copy { display:grid; min-inline-size:0; gap:.15rem; }
.name,.meta { min-inline-size:0; overflow-wrap:anywhere; }
.meta { color:var(--vc-space-color-text-muted,#5d6670); font-size:var(--vc-space-text-caption-size,.75rem); }
a:focus-visible { outline:3px solid var(--vc-space-color-focus,#2366d1); outline-offset:2px; }
@media (forced-colors:active),(prefers-contrast:more) { .attachment,.mark { border:2px solid CanvasText; background:Canvas; color:CanvasText; } }
`;

function createSpaceChatAttachmentElementClass() {
  return class VcSpaceChatAttachmentElement extends HTMLElement implements SpaceChatAttachmentElement {
    static readonly observedAttributes = [
      "download-url",
      "kind",
      "locale",
      "media-type",
      "name",
      "preview-url",
      "size",
    ];
    #attachment: SpaceChatAttachmentView | null = null;
    get attachment() { return this.#attachment; }
    set attachment(value) {
      this.#attachment = value;
      if (this.isConnected) this.render();
    }
    connectedCallback() {
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      this.render();
    }
    attributeChangedCallback() {
      if (this.isConnected && !this.#attachment) this.render();
    }
    private render() {
      const root = this.shadowRoot;
      if (!root) return;
      const attachment = this.#attachment ?? attachmentFromAttributes(this);
      const style = this.ownerDocument.createElement("style");
      style.textContent = spaceChatAttachmentStyles;
      if (!attachment) {
        root.replaceChildren(style);
        return;
      }
      const url = sanitizeSpaceMediaUrl(attachment.downloadUrl);
      const container = this.ownerDocument.createElement(url ? "a" : "div");
      container.className = "attachment";
      container.setAttribute("part", "attachment");
      container.setAttribute("data-testid", "message-attachment");
      if (container instanceof HTMLAnchorElement && url) {
        container.href = url;
        container.target = "_blank";
        container.rel = "noopener noreferrer";
      }
      const previewUrl = attachment.kind === "image"
        ? sanitizeSpaceMediaUrl(attachment.previewUrl || url)
        : null;
      if (previewUrl) {
        const image = this.ownerDocument.createElement("img");
        image.className = "preview";
        image.src = previewUrl;
        image.alt = attachment.name;
        image.loading = "lazy";
        image.setAttribute("part", "preview");
        image.addEventListener("error", () => image.remove(), { once: true });
        container.append(image);
      } else {
        const mark = this.ownerDocument.createElement("span");
        mark.className = "mark";
        mark.textContent = attachment.kind === "image" ? "IMG" : "FILE";
        mark.setAttribute("aria-hidden", "true");
        mark.setAttribute("part", "mark");
        container.append(mark);
      }
      const copy = this.ownerDocument.createElement("span");
      copy.className = "copy";
      const name = this.ownerDocument.createElement("strong");
      name.className = "name";
      name.textContent = attachment.name;
      const meta = this.ownerDocument.createElement("span");
      meta.className = "meta";
      meta.textContent = [
        attachment.mediaType,
        formatBytes(attachment.size, localeFor(this)),
      ].filter(Boolean).join(" · ");
      copy.append(name, meta);
      container.append(copy);
      root.replaceChildren(style, container);
    }
  };
}

export const spaceReactionBarStyles = `
:host { display:block; min-inline-size:0; color:var(--vc-space-color-text,#172026); font-family:var(--vc-space-font-body,sans-serif); }
:host([hidden]) { display:none; }
.bar { display:flex; min-inline-size:0; flex-wrap:wrap; gap:.35rem; }
button { min-inline-size:2.75rem; min-block-size:2.75rem; padding:.45rem .7rem; border:1px solid var(--vc-space-color-border,#8a929a); border-radius:999px; color:var(--vc-space-color-text-muted,#5d6670); background:var(--vc-space-color-surface,#f5f2eb); font:700 .78rem/1 var(--vc-space-font-body,sans-serif); cursor:pointer; overflow-wrap:anywhere; }
button[aria-pressed="true"] { border-width:2px; color:var(--vc-space-color-text,#172026); background:color-mix(in srgb,var(--vc-space-color-accent,#d95835) 14%,var(--vc-space-color-surface,#f5f2eb)); }
button:focus-visible { outline:3px solid var(--vc-space-color-focus,#2366d1); outline-offset:2px; }
button:disabled { cursor:not-allowed; opacity:.55; }
@media (forced-colors:active),(prefers-contrast:more) { button,button[aria-pressed="true"] { border:2px solid CanvasText; background:Canvas; color:CanvasText; } button[aria-pressed="true"] { outline:1px solid CanvasText; } }
`;

function createSpaceReactionBarElementClass() {
  return class VcSpaceReactionBarElement extends HTMLElement implements SpaceReactionBarElement {
    static readonly observedAttributes = ["disabled", "locale", "message-id"];
    #messageId = "";
    #reactions: readonly SpaceChatReactionView[] | null = null;
    get messageId() { return this.#messageId || this.getAttribute("message-id") || ""; }
    set messageId(value) { this.#messageId = value; if (this.isConnected) this.render(); }
    get reactions() { return this.#reactions ?? []; }
    set reactions(value) { this.#reactions = Object.freeze([...(value ?? [])]); if (this.isConnected) this.render(); }
    get disabled() { return this.hasAttribute("disabled"); }
    set disabled(value) { this.toggleAttribute("disabled", Boolean(value)); }
    connectedCallback() { if (!this.shadowRoot) this.attachShadow({ mode: "open" }); this.render(); }
    attributeChangedCallback() { if (this.isConnected) this.render(); }
    private render() {
      const root = this.shadowRoot;
      if (!root) return;
      const translate = createSpaceComponentTranslator(localeFor(this));
      const style = this.ownerDocument.createElement("style");
      style.textContent = spaceReactionBarStyles;
      const bar = this.ownerDocument.createElement("div");
      bar.className = "bar";
      bar.setAttribute("part", "bar");
      bar.setAttribute("aria-label", translate("space.components.chat.reactions.label"));
      for (const reaction of this.reactions) {
        const button = this.ownerDocument.createElement("button");
        button.type = "button";
        button.disabled = this.disabled;
        button.setAttribute("part", "reaction");
        button.setAttribute("aria-pressed", String(reaction.reactedBySelf));
        button.setAttribute("aria-label", translate("space.components.chat.reaction.button", {
          emoji: reaction.emoji,
          count: reaction.count,
          current: reaction.reactedBySelf
            ? translate("space.components.chat.reaction.current")
            : translate("space.components.chat.reaction.not-current"),
        }));
        button.textContent = `${reaction.emoji} ${reaction.count}`;
        button.addEventListener("click", () => emit(
          this,
          spaceChatEventNames.reaction,
          { messageId: this.messageId, emoji: reaction.emoji },
        ));
        bar.append(button);
      }
      root.replaceChildren(style, bar);
    }
  };
}

export const spaceMessageActionsStyles = `
:host { position:relative; display:block; min-inline-size:0; color:var(--vc-space-color-text,#172026); font-family:var(--vc-space-font-body,sans-serif); }
.actions { display:flex; min-inline-size:0; flex-wrap:wrap; gap:.35rem; }
.actions[hidden] { display:none; }
button { min-block-size:2.75rem; padding:.45rem .7rem; border:1px solid var(--vc-space-color-border,#8a929a); border-radius:var(--vc-space-radius-control,.55rem); color:inherit; background:var(--vc-space-color-surface,#f5f2eb); font:700 .76rem/1 var(--vc-space-font-body,sans-serif); cursor:pointer; }
button:not(:disabled):hover { border-color:color-mix(in srgb,var(--vc-space-color-accent,#d95835) 45%,var(--vc-space-color-border,#8a929a)); background:color-mix(in srgb,var(--vc-space-color-accent,#d95835) 8%,var(--vc-space-color-surface,#f5f2eb)); }
button:focus-visible { outline:3px solid var(--vc-space-color-focus,#2366d1); outline-offset:2px; }
button:disabled { cursor:not-allowed; opacity:.55; }
.trigger { display:inline-grid; min-inline-size:2.75rem; place-items:center; padding:.45rem; }
.trigger svg { inline-size:1.1rem; block-size:1.1rem; fill:currentColor; }
.backdrop { display:none; position:fixed; z-index:20; inset:0; background:rgba(0,0,0,.42); }
.backdrop[hidden],.menu[hidden] { display:none; }
.menu { box-sizing:border-box; position:fixed; z-index:21; inset:auto; display:grid; min-inline-size:13rem; max-inline-size:min(19rem,calc(100vw - 1.5rem)); max-block-size:calc(100vh - 1.5rem); overflow:auto; gap:.45rem; margin:0; padding:.65rem; border:1px solid var(--vc-space-color-border,#8a929a); border-radius:var(--vc-space-radius-card,.9rem); background:var(--vc-space-color-surface-raised,#fff); box-shadow:0 .75rem 2rem rgba(23,32,38,.18); }
.menu::backdrop { background:transparent; }
.menu-header { display:flex; align-items:center; justify-content:space-between; gap:.75rem; padding-inline:.2rem; }
.menu-title,.reaction-title { color:var(--vc-space-color-text-muted,#5d6670); font-size:var(--vc-space-text-caption-size,.76rem); font-weight:760; line-height:1.35; }
.close { min-block-size:2rem; padding:.3rem .42rem; border-color:transparent; background:transparent; }
.menu-actions,.reaction-choices { display:grid; gap:.25rem; }
.reaction-choices { grid-template-columns:repeat(auto-fit,minmax(2.75rem,1fr)); }
.reaction-title { grid-column:1/-1; padding:.2rem; }
.menu-action { inline-size:100%; justify-self:stretch; text-align:start; }
.reaction-choice { min-inline-size:2.75rem; padding:.45rem; font-size:1rem; }
.danger { color:var(--vc-space-color-negative,#a33b43); }
@media (max-width:30rem) {
  .menu { position:fixed; z-index:31; inset-inline:.75rem; inset-block-end:max(.75rem,env(safe-area-inset-bottom)); inline-size:calc(100vw - 1.5rem); max-inline-size:none; max-block-size:min(70vh,30rem); overflow:auto; padding:.85rem; border-radius:1rem; box-shadow:0 1rem 3rem rgba(0,0,0,.32); }
  .menu::backdrop { background:rgba(0,0,0,.42); }
  .backdrop:not([hidden]) { display:block; z-index:30; }
  .menu-actions { gap:.4rem; }
  .menu-action { min-block-size:3rem; }
}
@media (prefers-reduced-motion:no-preference) {
  .menu { animation:vc-space-action-menu-in 140ms cubic-bezier(.2,.8,.2,1); }
  @keyframes vc-space-action-menu-in { from { opacity:.82; transform:translateY(.35rem); } }
}
@media (forced-colors:active),(prefers-contrast:more) { button,.menu { border:2px solid CanvasText; background:Canvas; color:CanvasText; } .backdrop,.menu::backdrop { background:CanvasText; opacity:.5; } .danger { color:CanvasText; text-decoration:underline; } }
`;

function createMoreActionsIcon(document: Document) {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  for (const x of [4, 10, 16]) {
    const circle = document.createElementNS(namespace, "circle");
    circle.setAttribute("cx", String(x));
    circle.setAttribute("cy", "10");
    circle.setAttribute("r", "1.6");
    svg.append(circle);
  }
  return svg;
}

function sameMessageActions(
  left: SpaceMessageActionsView | null,
  right: SpaceMessageActionsView | null,
) {
  return left === right || Boolean(left && right
    && left.messageId === right.messageId
    && left.canReply === right.canReply
    && left.canEdit === right.canEdit
    && left.canDelete === right.canDelete
    && left.canRetry === right.canRetry
    && left.disabled === right.disabled);
}

function createSpaceMessageActionsElementClass() {
  return class VcSpaceMessageActionsElement extends HTMLElement implements SpaceMessageActionsElement {
    static readonly observedAttributes = ["compact", "locale"];
    #actions: SpaceMessageActionsView | null = null;
    #reactionChoices: readonly string[] = Object.freeze([]);
    #trigger: HTMLButtonElement | null = null;
    #menu: HTMLElement | null = null;
    #backdrop: HTMLElement | null = null;
    #open = false;
    #usesPopover = false;

    get actions() { return this.#actions; }
    set actions(value) {
      if (sameMessageActions(this.#actions, value)) return;
      this.#actions = value;
      if (this.isConnected) this.render();
    }
    get compact() { return this.hasAttribute("compact"); }
    set compact(value) { this.toggleAttribute("compact", Boolean(value)); }
    get reactionChoices() { return this.#reactionChoices; }
    set reactionChoices(value) {
      const normalized = Object.freeze([...new Set(
        (value ?? []).map((choice) => String(choice).trim()).filter(Boolean),
      )]);
      if (
        normalized.length === this.#reactionChoices.length
        && normalized.every((choice, index) => choice === this.#reactionChoices[index])
      ) return;
      this.#reactionChoices = normalized;
      if (this.isConnected) this.render();
    }

    connectedCallback() { if (!this.shadowRoot) this.attachShadow({ mode: "open" }); this.render(); }
    disconnectedCallback() { this.closeMenu(false); }
    attributeChangedCallback(
      _name: string,
      oldValue: string | null,
      newValue: string | null,
    ) {
      if (this.isConnected && oldValue !== newValue) this.render();
    }

    readonly #handleDocumentPointerDown = (event: PointerEvent) => {
      if (this.#open && !event.composedPath().includes(this)) {
        this.closeMenu(false);
        this.restoreTriggerFocusAfterPointer();
      }
    };

    readonly #handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (!this.#open) return;
      if (event.key === "Escape") {
        event.preventDefault();
        this.closeMenu();
        return;
      }
      if (event.key !== "Tab" || !this.#menu) return;
      const focusable = Array.from(
        this.#menu.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
      );
      if (focusable.length === 0) return;
      const active = this.shadowRoot?.activeElement;
      const current = focusable.indexOf(active as HTMLButtonElement);
      const next = event.shiftKey
        ? (current <= 0 ? focusable.length - 1 : current - 1)
        : (current < 0 || current === focusable.length - 1 ? 0 : current + 1);
      event.preventDefault();
      focusable[next]?.focus();
    };

    readonly #handleWindowResize = () => {
      if (this.#open) this.positionMenu();
    };

    private restoreTriggerFocusAfterPointer() {
      const restoreFocus = () => {
        if (!this.#open && this.#trigger?.isConnected) this.#trigger.focus();
      };
      const view = this.ownerDocument.defaultView;
      if (view && typeof view.requestAnimationFrame === "function") {
        view.requestAnimationFrame(restoreFocus);
      } else {
        Promise.resolve().then(restoreFocus);
      }
    }

    private clearMenuPosition() {
      for (const property of ["inset", "left", "right", "top", "bottom"]) {
        this.#menu?.style.removeProperty(property);
      }
    }

    private positionMenu() {
      const menu = this.#menu;
      const trigger = this.#trigger;
      const view = this.ownerDocument.defaultView;
      if (!menu || !trigger || !view) return;
      this.clearMenuPosition();
      if (view.matchMedia("(max-width: 30rem)").matches) return;

      const viewportPadding = 12;
      const triggerGap = 8;
      const triggerRect = trigger.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const direction = view.getComputedStyle(this).direction;
      const preferredLeft = direction === "rtl"
        ? triggerRect.left
        : triggerRect.right - menuRect.width;
      const maximumLeft = Math.max(
        viewportPadding,
        view.innerWidth - menuRect.width - viewportPadding,
      );
      const left = Math.min(
        Math.max(viewportPadding, preferredLeft),
        maximumLeft,
      );
      const availableAbove = triggerRect.top - viewportPadding - triggerGap;
      const availableBelow = view.innerHeight
        - triggerRect.bottom
        - viewportPadding
        - triggerGap;
      const opensBelow = availableBelow >= menuRect.height
        || availableBelow >= availableAbove;
      const preferredTop = opensBelow
        ? triggerRect.bottom + triggerGap
        : triggerRect.top - menuRect.height - triggerGap;
      const maximumTop = Math.max(
        viewportPadding,
        view.innerHeight - menuRect.height - viewportPadding,
      );
      const top = Math.min(
        Math.max(viewportPadding, preferredTop),
        maximumTop,
      );

      menu.style.left = `${Math.round(left)}px`;
      menu.style.top = `${Math.round(top)}px`;
      menu.style.right = "auto";
      menu.style.bottom = "auto";
    }

    private resetDeleteConfirmation() {
      const button = this.#menu?.querySelector<HTMLButtonElement>(
        ".menu-action.danger[data-confirm='true']",
      );
      if (!button) return;
      button.removeAttribute("data-confirm");
      button.removeAttribute("aria-label");
      button.textContent = createSpaceComponentTranslator(localeFor(this))(
        "space.components.chat.action.delete",
      );
    }

    private openMenu() {
      if (!this.#menu || !this.#backdrop || !this.#trigger || this.#open) return;
      this.resetDeleteConfirmation();
      this.#open = true;
      this.#menu.hidden = false;
      let usesPopover = false;
      if (typeof this.#menu.showPopover === "function") {
        try {
          this.#menu.showPopover();
          usesPopover = true;
        } catch {
          usesPopover = false;
        }
      }
      this.#usesPopover = usesPopover;
      this.#backdrop.hidden = usesPopover;
      this.positionMenu();
      this.#trigger.setAttribute("aria-expanded", "true");
      if (!usesPopover) {
        this.ownerDocument.addEventListener("pointerdown", this.#handleDocumentPointerDown);
      }
      this.ownerDocument.addEventListener("keydown", this.#handleDocumentKeyDown);
      this.ownerDocument.defaultView?.addEventListener("resize", this.#handleWindowResize);
      Promise.resolve().then(() => {
        this.#menu?.querySelector<HTMLButtonElement>(
          ".reaction-choice:not(:disabled),.menu-action:not(:disabled),.close:not(:disabled)",
        )?.focus();
      });
    }

    private closeMenu(restoreFocus = true) {
      if (!this.#open) return;
      this.resetDeleteConfirmation();
      this.#open = false;
      if (
        this.#menu
        && typeof this.#menu.hidePopover === "function"
        && this.#menu.matches(":popover-open")
      ) this.#menu.hidePopover();
      if (this.#menu) this.#menu.hidden = true;
      if (this.#backdrop) this.#backdrop.hidden = true;
      this.#trigger?.setAttribute("aria-expanded", "false");
      this.ownerDocument.removeEventListener("pointerdown", this.#handleDocumentPointerDown);
      this.ownerDocument.removeEventListener("keydown", this.#handleDocumentKeyDown);
      this.ownerDocument.defaultView?.removeEventListener("resize", this.#handleWindowResize);
      this.#usesPopover = false;
      this.clearMenuPosition();
      if (restoreFocus) this.#trigger?.focus();
    }

    private appendActionButton(
      container: HTMLElement,
      action: "reply" | "edit" | "delete" | "retry",
      eventName: typeof spaceChatEventNames.reply
        | typeof spaceChatEventNames.edit
        | typeof spaceChatEventNames.delete
        | typeof spaceChatEventNames.retry,
      actions: SpaceMessageActionsView,
      menuItem: boolean,
    ) {
      const translate = createSpaceComponentTranslator(localeFor(this));
      const button = this.ownerDocument.createElement("button");
      button.type = "button";
      button.disabled = actions.disabled === true;
      button.className = menuItem
        ? `menu-action${action === "delete" ? " danger" : ""}`
        : "";
      button.setAttribute("part", action);
      if (action === "retry") button.setAttribute("data-testid", "retry-message");
      button.textContent = translate(`space.components.chat.action.${action}`);
      button.addEventListener("click", () => {
        if (menuItem && action === "delete" && button.dataset.confirm !== "true") {
          button.dataset.confirm = "true";
          button.textContent = translate("space.components.chat.action.confirm-delete");
          button.setAttribute(
            "aria-label",
            translate("space.components.chat.action.confirm-delete"),
          );
          return;
        }
        emit(this, eventName, { messageId: actions.messageId });
        if (menuItem) this.closeMenu();
      });
      container.append(button);
    }

    private render() {
      this.closeMenu(false);
      this.#trigger = null;
      this.#menu = null;
      this.#backdrop = null;
      const root = this.shadowRoot;
      if (!root) return;
      const translate = createSpaceComponentTranslator(localeFor(this));
      const style = this.ownerDocument.createElement("style");
      style.textContent = spaceMessageActionsStyles;
      const container = this.ownerDocument.createElement("div");
      container.className = "actions";
      container.setAttribute("part", "actions");
      const actions = this.#actions;
      const definitions = actions ? [
        ["reply", actions.canReply, spaceChatEventNames.reply],
        ["edit", actions.canEdit, spaceChatEventNames.edit],
        ["delete", actions.canDelete, spaceChatEventNames.delete],
        ["retry", actions.canRetry, spaceChatEventNames.retry],
      ] as const : [];
      const allowedDefinitions = definitions.filter(([, allowed]) => allowed);
      const hasReactionChoices = Boolean(actions) && this.#reactionChoices.length > 0;
      container.hidden = !actions || (allowedDefinitions.length === 0 && !hasReactionChoices);

      if (this.compact && actions && !container.hidden) {
        const trigger = this.ownerDocument.createElement("button");
        trigger.className = "trigger";
        trigger.type = "button";
        trigger.disabled = actions.disabled === true;
        trigger.setAttribute("part", "trigger");
        trigger.setAttribute("data-testid", "message-actions-more");
        trigger.setAttribute("aria-haspopup", "dialog");
        trigger.setAttribute("aria-expanded", "false");
        trigger.setAttribute("aria-label", translate("space.components.chat.action.menu"));
        trigger.append(createMoreActionsIcon(this.ownerDocument));

        const backdrop = this.ownerDocument.createElement("div");
        backdrop.className = "backdrop";
        backdrop.hidden = true;
        backdrop.setAttribute("part", "backdrop");
        backdrop.addEventListener("click", () => this.closeMenu());

        const menu = this.ownerDocument.createElement("div");
        menu.className = "menu";
        menu.hidden = true;
        menu.setAttribute("popover", "auto");
        menu.setAttribute("part", "menu");
        menu.setAttribute("role", "dialog");
        menu.setAttribute("aria-modal", "true");
        menu.setAttribute("aria-label", translate("space.components.chat.action.menu"));
        menu.setAttribute("data-testid", "message-actions-menu");
        menu.addEventListener("toggle", () => {
          if (!this.#open || menu.matches(":popover-open")) return;
          this.closeMenu(false);
          this.restoreTriggerFocusAfterPointer();
        });
        const header = this.ownerDocument.createElement("div");
        header.className = "menu-header";
        const title = this.ownerDocument.createElement("span");
        title.className = "menu-title";
        title.setAttribute("part", "menu-title");
        title.textContent = translate("space.components.chat.action.menu");
        const close = this.ownerDocument.createElement("button");
        close.className = "close";
        close.type = "button";
        close.setAttribute("part", "menu-close");
        close.textContent = translate("space.components.chat.action.close");
        close.addEventListener("click", () => this.closeMenu());
        header.append(title, close);
        menu.append(header);

        if (hasReactionChoices) {
          const choices = this.ownerDocument.createElement("div");
          choices.className = "reaction-choices";
          choices.setAttribute("part", "reaction-choices");
          const choicesTitle = this.ownerDocument.createElement("span");
          choicesTitle.className = "reaction-title";
          choicesTitle.textContent = translate("space.components.chat.reaction.add");
          choices.append(choicesTitle);
          for (const emoji of this.#reactionChoices) {
            const choice = this.ownerDocument.createElement("button");
            choice.className = "reaction-choice";
            choice.type = "button";
            choice.disabled = actions.disabled === true;
            choice.setAttribute("part", "reaction-choice");
            choice.setAttribute("aria-label", translate(
              "space.components.chat.reaction.choice",
              { emoji },
            ));
            choice.textContent = emoji;
            choice.addEventListener("click", () => {
              emit(this, spaceChatEventNames.reaction, {
                messageId: actions.messageId,
                emoji,
              });
              this.closeMenu();
            });
            choices.append(choice);
          }
          menu.append(choices);
        }

        const menuActions = this.ownerDocument.createElement("div");
        menuActions.className = "menu-actions";
        for (const [action, , eventName] of allowedDefinitions) {
          this.appendActionButton(menuActions, action, eventName, actions, true);
        }
        menu.append(menuActions);
        trigger.addEventListener("click", () => {
          if (this.#open) this.closeMenu();
          else this.openMenu();
        });
        container.append(trigger, backdrop, menu);
        this.#trigger = trigger;
        this.#backdrop = backdrop;
        this.#menu = menu;
        root.replaceChildren(style, container);
        return;
      }

      for (const [action, allowed, eventName] of definitions) {
        if (!allowed || !actions) continue;
        this.appendActionButton(container, action, eventName, actions, false);
      }
      root.replaceChildren(style, container);
    }
  };
}

export const spaceChatErrorStateStyles = `
:host { display:block; color:var(--vc-space-color-negative,#a33b43); font-family:var(--vc-space-font-body,sans-serif); }
.error { display:flex; align-items:center; justify-content:space-between; gap:.75rem; padding:.6rem .7rem; border:1px solid currentColor; border-radius:var(--vc-space-radius-control,.65rem); background:color-mix(in srgb,var(--vc-space-color-negative,#a33b43) 8%,var(--vc-space-color-surface-raised,#fff)); }
.error[hidden] { display:none; }
.copy { min-inline-size:0; overflow-wrap:anywhere; }
button { min-inline-size:2.75rem; min-block-size:2.75rem; border:1px solid currentColor; border-radius:var(--vc-space-radius-control,.55rem); color:inherit; background:transparent; font:700 .76rem/1 var(--vc-space-font-body,sans-serif); cursor:pointer; }
button:focus-visible { outline:3px solid var(--vc-space-color-focus,#2366d1); outline-offset:2px; }
@media (forced-colors:active),(prefers-contrast:more) { .error,button { border:2px solid CanvasText; background:Canvas; color:CanvasText; } }
`;

function createSpaceChatErrorStateElementClass() {
  return class VcSpaceChatErrorStateElement extends HTMLElement implements SpaceChatErrorStateElement {
    #error: SpaceChatCommandError | null = null;
    get error() { return this.#error; }
    set error(value) { this.#error = value; if (this.isConnected) this.render(); }
    connectedCallback() {
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      this.setAttribute("role", "alert");
      this.setAttribute("aria-live", "assertive");
      this.render();
    }
    private render() {
      const root = this.shadowRoot;
      if (!root) return;
      const translate = createSpaceComponentTranslator(localeFor(this));
      const style = this.ownerDocument.createElement("style");
      style.textContent = spaceChatErrorStateStyles;
      const container = this.ownerDocument.createElement("div");
      container.className = "error";
      container.hidden = !this.#error;
      container.setAttribute("part", "error");
      const copy = this.ownerDocument.createElement("span");
      copy.className = "copy";
      copy.textContent = this.#error?.message || "";
      copy.setAttribute("part", "message");
      const dismiss = this.ownerDocument.createElement("button");
      dismiss.type = "button";
      dismiss.textContent = translate("space.components.chat.error.dismiss");
      dismiss.setAttribute("part", "dismiss");
      dismiss.addEventListener("click", () => {
        if (this.#error) emit(this, spaceChatEventNames.dismissError, {
          command: this.#error.command,
        });
      });
      container.append(copy, dismiss);
      root.replaceChildren(style, container);
    }
  };
}

export const spaceChatTimelineStyles = `
:host { display:block; min-block-size:0; color:var(--vc-space-color-text,#172026); font-family:var(--vc-space-font-body,sans-serif); }
.viewport { min-block-size:12rem; max-block-size:var(--vc-space-chat-timeline-max-height,40rem); overflow:auto; overscroll-behavior:contain; padding:.75rem; border:1px solid var(--vc-space-color-border,#8a929a); border-radius:var(--vc-space-radius-card,.9rem); background:var(--vc-space-color-surface,#f5f2eb); scrollbar-gutter:stable; }
.status { display:grid; min-block-size:9rem; place-items:center; padding:1.5rem; color:var(--vc-space-color-text-muted,#5d6670); text-align:center; overflow-wrap:anywhere; }
.status[hidden],.list[hidden] { display:none; }
.list { display:grid; min-inline-size:0; gap:.18rem; }
.entry { display:grid; min-inline-size:0; gap:.45rem; }
.entry[data-group="single"],.entry[data-group="last"] { margin-block-end:.72rem; }
.entry ${spaceChatAttachmentElementName} { margin-inline-start:2.6rem; max-inline-size:34rem; }
.entry[data-own="true"] ${spaceChatAttachmentElementName} { margin-inline-start:auto; }
.controls { display:flex; inline-size:fit-content; max-inline-size:calc(100% - 2.6rem); min-inline-size:0; flex-wrap:wrap; align-items:center; gap:.35rem; margin-inline-start:2.6rem; }
.controls[data-own="true"] { justify-content:flex-end; margin-inline-start:auto; }
.controls[hidden] { display:none; }
.typing { margin-block-start:.65rem; }
.viewport:focus-visible { outline:3px solid var(--vc-space-color-focus,#2366d1); outline-offset:2px; }
@media (max-width:24rem) { .viewport { padding:.55rem; } .entry ${spaceChatAttachmentElementName},.controls { max-inline-size:100%; margin-inline-start:0; } .controls[data-own="true"] { margin-inline-start:auto; } }
@media (forced-colors:active),(prefers-contrast:more) { .viewport { border:2px solid CanvasText; background:Canvas; color:CanvasText; } .status { color:CanvasText; } }
`;

const spaceChatMessageGroupWindowMs = 5 * 60 * 1_000;

function messagesShareGroup(
  previous: SpaceChatMessageView | undefined,
  next: SpaceChatMessageView | undefined,
) {
  if (!previous || !next) return false;
  if (
    previous.author.id !== next.author.id
    || previous.author.kind !== next.author.kind
    || previous.isOwn !== next.isOwn
  ) return false;
  const previousTime = new Date(previous.createdAt).valueOf();
  const nextTime = new Date(next.createdAt).valueOf();
  return Number.isFinite(previousTime)
    && Number.isFinite(nextTime)
    && nextTime >= previousTime
    && nextTime - previousTime <= spaceChatMessageGroupWindowMs;
}

export function getSpaceChatMessageGroupPositions(
  messages: readonly SpaceChatMessageView[],
): readonly SpaceChatMessageGroupPosition[] {
  return Object.freeze(messages.map((message, index) => {
    const joinsPrevious = messagesShareGroup(messages[index - 1], message);
    const joinsNext = messagesShareGroup(message, messages[index + 1]);
    if (joinsPrevious && joinsNext) return "middle";
    if (joinsPrevious) return "last";
    if (joinsNext) return "first";
    return "single";
  }));
}

interface TimelineEntry {
  readonly wrapper: HTMLElement;
  readonly messageElement: HTMLElement & {
    groupPosition: SpaceChatMessageGroupPosition;
    message: SpaceChatMessageView | null;
    showReactions: boolean;
  };
  readonly controls: HTMLElement;
  readonly actionsElement: SpaceMessageActionsElement;
  readonly reactionsElement: SpaceReactionBarElement;
  message: SpaceChatMessageView;
}

const noSpaceChatActions: SpaceChatActionAvailability = Object.freeze({
  reply: false,
  edit: false,
  delete: false,
  retry: false,
  react: false,
});

function createSpaceChatTimelineElementClass() {
  return class VcSpaceChatTimelineElement extends HTMLElement implements SpaceChatTimelineElement {
    static readonly observedAttributes = [
      "error",
      "interaction-disabled",
      "interactive",
      "locale",
      "state",
    ];
    #messages: readonly SpaceChatMessageView[] = Object.freeze([]);
    #typingUsers: readonly SpaceChatAuthorView[] = Object.freeze([]);
    #state: SpaceChatTimelineState = "loading";
    #error: string | null = null;
    #reactionChoices: readonly string[] = Object.freeze([]);
    #viewport: HTMLElement | null = null;
    #status: HTMLElement | null = null;
    #list: HTMLElement | null = null;
    #typing: HTMLElement & { users?: readonly SpaceChatAuthorView[] } | null = null;
    #entries = new Map<string, TimelineEntry>();

    get messages() { return this.#messages; }
    set messages(value) { this.#messages = Object.freeze([...(value ?? [])]); if (this.isConnected) this.update(); }
    get typingUsers() { return this.#typingUsers; }
    set typingUsers(value) { this.#typingUsers = Object.freeze([...(value ?? [])]); if (this.isConnected) this.updateTyping(); }
    get state() { return this.#state; }
    set state(value) { this.#state = value === "error" || value === "ready" ? value : "loading"; if (this.isConnected) this.update(); }
    get error() { return this.#error; }
    set error(value) { this.#error = value?.trim() || null; if (this.isConnected) this.update(); }
    get interactive() { return this.hasAttribute("interactive"); }
    set interactive(value) { this.toggleAttribute("interactive", Boolean(value)); }
    get interactionDisabled() { return this.hasAttribute("interaction-disabled"); }
    set interactionDisabled(value) {
      this.toggleAttribute("interaction-disabled", Boolean(value));
    }
    get reactionChoices() { return this.#reactionChoices; }
    set reactionChoices(value) {
      this.#reactionChoices = Object.freeze([...new Set(
        (value ?? []).map((choice) => String(choice).trim()).filter(Boolean),
      )]);
      if (this.isConnected) this.update();
    }

    connectedCallback() {
      if (!this.shadowRoot) this.build();
      this.syncAttributes();
      this.update();
    }
    attributeChangedCallback() { if (this.isConnected) { this.syncAttributes(); this.update(); } }

    private build() {
      const root = this.attachShadow({ mode: "open" });
      const style = this.ownerDocument.createElement("style");
      style.textContent = spaceChatTimelineStyles;
      const viewport = this.ownerDocument.createElement("div");
      viewport.className = "viewport";
      viewport.tabIndex = 0;
      viewport.setAttribute("part", "viewport");
      viewport.setAttribute("role", "log");
      viewport.setAttribute("aria-live", "polite");
      viewport.setAttribute("aria-relevant", "additions text");
      const status = this.ownerDocument.createElement("div");
      status.className = "status";
      status.setAttribute("part", "status");
      const list = this.ownerDocument.createElement("div");
      list.className = "list";
      list.setAttribute("part", "list");
      const typing = this.ownerDocument.createElement("vc-space-typing-indicator") as HTMLElement & { users?: readonly SpaceChatAuthorView[] };
      typing.className = "typing";
      typing.setAttribute("part", "typing");
      typing.setAttribute("data-testid", "typing-indicator");
      viewport.append(status, list, typing);
      root.replaceChildren(style, viewport);
      this.#viewport = viewport;
      this.#status = status;
      this.#list = list;
      this.#typing = typing;
    }

    private syncAttributes() {
      const state = this.getAttribute("state");
      if (state) this.#state = state === "error" || state === "ready" ? state : "loading";
      if (!this.#error) this.#error = this.getAttribute("error")?.trim() || null;
    }

    private update() {
      const viewport = this.#viewport;
      const status = this.#status;
      const list = this.#list;
      if (!viewport || !status || !list) return;
      const nearBottom = viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <= 64;
      const previousCount = this.#entries.size;
      const translate = createSpaceComponentTranslator(localeFor(this));
      const error = this.#state === "error" || this.#error;
      const empty = this.#state === "ready" && this.#messages.length === 0 && !error;
      status.hidden = this.#state === "ready" && !empty && !error;
      status.textContent = error
        ? this.#error || translate("space.components.chat.timeline.error")
        : empty
          ? translate("space.components.chat.timeline.empty")
          : translate("space.components.chat.timeline.loading");
      list.hidden = this.#state !== "ready" || Boolean(error) || empty;
      viewport.setAttribute("aria-busy", String(this.#state === "loading"));
      const nextIds = new Set(this.#messages.map((message) => message.id));
      for (const [id, entry] of this.#entries) {
        if (!nextIds.has(id)) {
          entry.wrapper.remove();
          this.#entries.delete(id);
        }
      }
      if (!list.hidden) {
        const groupPositions = getSpaceChatMessageGroupPositions(this.#messages);
        for (const [index, message] of this.#messages.entries()) {
          let entry = this.#entries.get(message.id);
          if (!entry) {
            const wrapper = this.ownerDocument.createElement("div");
            wrapper.className = "entry";
            wrapper.dataset.messageId = message.id;
            wrapper.setAttribute("part", "entry");
            wrapper.setAttribute("data-testid", "chat-message-entry");
            const messageElement = this.ownerDocument.createElement("vc-space-chat-message") as TimelineEntry["messageElement"];
            messageElement.setAttribute("part", "message");
            messageElement.setAttribute(
              "exportparts",
              "message:message-body,avatar:message-avatar,content:message-content,reactions:readonly-reactions,reaction:readonly-reaction",
            );
            const controls = this.ownerDocument.createElement("div");
            controls.className = "controls";
            controls.setAttribute("part", "controls");
            const actionsElement = this.ownerDocument.createElement(
              spaceMessageActionsElementName,
            ) as SpaceMessageActionsElement;
            actionsElement.setAttribute("part", "actions");
            actionsElement.setAttribute(
              "exportparts",
              "actions:message-actions,trigger:message-action-more,backdrop:message-action-backdrop,menu:message-action-menu,menu-title:message-action-menu-title,menu-close:message-action-menu-close,reaction-choices:message-reaction-choices,reaction-choice:message-reaction-choice,reply:message-action-reply,edit:message-action-edit,delete:message-action-delete,retry:message-action-retry",
            );
            actionsElement.compact = true;
            const reactionsElement = this.ownerDocument.createElement(
              spaceReactionBarElementName,
            ) as SpaceReactionBarElement;
            reactionsElement.setAttribute("part", "reactions");
            reactionsElement.setAttribute(
              "exportparts",
              "bar:reaction-bar,reaction:reaction",
            );
            controls.append(reactionsElement, actionsElement);
            wrapper.append(messageElement, controls);
            entry = {
              wrapper,
              messageElement,
              controls,
              actionsElement,
              reactionsElement,
              message,
            };
            this.#entries.set(message.id, entry);
          }
          if (entry.message !== message) {
            entry.message = message;
            entry.messageElement.message = message;
          } else if (!entry.messageElement.message) {
            entry.messageElement.message = message;
          }
          const interactive = this.interactive;
          const actions = message.actions ?? noSpaceChatActions;
          const groupPosition = groupPositions[index] ?? "single";
          const showActions = interactive && (
            actions.reply
            || actions.edit
            || actions.delete
            || actions.retry
            || (actions.react && this.#reactionChoices.length > 0)
          );
          const showReactions = interactive
            && message.reactions.length > 0;
          entry.messageElement.groupPosition = groupPosition;
          entry.messageElement.showReactions = !interactive;
          entry.wrapper.dataset.group = groupPosition;
          entry.wrapper.dataset.own = String(message.isOwn);
          entry.controls.dataset.own = String(message.isOwn);
          entry.controls.hidden = !showActions && !showReactions;
          entry.actionsElement.setAttribute("locale", localeFor(this));
          entry.actionsElement.actions = showActions
            ? {
                messageId: message.id,
                canReply: actions.reply,
                canEdit: actions.edit,
                canDelete: actions.delete,
                canRetry: actions.retry,
                disabled: this.interactionDisabled,
            }
            : null;
          entry.actionsElement.reactionChoices = actions.react
            ? this.#reactionChoices
            : Object.freeze([]);
          entry.reactionsElement.setAttribute("locale", localeFor(this));
          entry.reactionsElement.messageId = message.id;
          entry.reactionsElement.hidden = !showReactions;
          entry.reactionsElement.reactions = showReactions
            ? message.reactions
            : Object.freeze([]);
          entry.reactionsElement.disabled = this.interactionDisabled || !actions.react;
          const existingAttachment = entry.wrapper.querySelector<SpaceChatAttachmentElement>(spaceChatAttachmentElementName);
          if (message.attachment) {
            const attachment = existingAttachment
              || this.ownerDocument.createElement(spaceChatAttachmentElementName) as SpaceChatAttachmentElement;
            attachment.attachment = message.attachment;
            if (!existingAttachment) entry.wrapper.insertBefore(attachment, entry.controls);
          } else {
            existingAttachment?.remove();
          }
          const expectedWrapper = list.children[index];
          if (expectedWrapper !== entry.wrapper) {
            list.insertBefore(entry.wrapper, expectedWrapper ?? null);
          }
        }
      }
      this.updateTyping();
      if (nearBottom || previousCount === 0) {
        Promise.resolve().then(() => {
          if (this.#viewport) this.#viewport.scrollTop = this.#viewport.scrollHeight;
        });
      }
    }

    private updateTyping() {
      if (this.#typing) this.#typing.users = this.#typingUsers;
    }
  };
}

export function renderSpaceChatAttachment(attachment: SpaceChatAttachmentView) {
  const attributes = [
    `name="${escapeSpaceAttribute(attachment.name)}"`,
    `kind="${attachment.kind}"`,
  ];
  const optional = {
    "media-type": attachment.mediaType,
    size: attachment.size,
    "download-url": sanitizeSpaceMediaUrl(attachment.downloadUrl),
    "preview-url": sanitizeSpaceMediaUrl(attachment.previewUrl),
  };
  for (const [name, value] of Object.entries(optional)) {
    if (value !== null) attributes.push(`${name}="${escapeSpaceAttribute(String(value))}"`);
  }
  return `<${spaceChatAttachmentElementName} ${attributes.join(" ")}></${spaceChatAttachmentElementName}>`;
}

export function defineSpaceChatInteractiveElements(
  registry: SpaceElementRegistry | undefined = globalThis.customElements,
) {
  if (!registry || typeof globalThis.HTMLElement !== "function") return false;
  defineSpaceMentionTargetItemElement(registry);
  defineSpaceElement(registry, spaceChatComposerElementName, createSpaceChatComposerElementClass);
  defineSpaceElement(registry, spaceMentionMenuElementName, createSpaceMentionMenuElementClass);
  defineSpaceElement(registry, spaceChatAttachmentElementName, createSpaceChatAttachmentElementClass);
  defineSpaceElement(registry, spaceReactionBarElementName, createSpaceReactionBarElementClass);
  defineSpaceElement(registry, spaceMessageActionsElementName, createSpaceMessageActionsElementClass);
  defineSpaceElement(registry, spaceChatErrorStateElementName, createSpaceChatErrorStateElementClass);
  defineSpaceElement(registry, spaceChatTimelineElementName, createSpaceChatTimelineElementClass);
  return true;
}
