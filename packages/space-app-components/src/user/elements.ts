import { createSpaceComponentTranslator } from "../core/context.js";
import {
  defineSpaceElements as defineSpaceAvatarElement,
  spaceAvatarElementName,
  type SpaceAvatarSize,
} from "../foundation/avatar.js";
import { defineSpaceElement, type SpaceElementRegistry } from "../foundation/element.js";
import { escapeSpaceAttribute, sanitizeSpaceMediaUrl } from "../foundation/safety.js";
import {
  defineSpaceStatusDotElement,
  spaceStatusDotElementName,
} from "../foundation/status-dot.js";
import type { SpaceUserIdentityView } from "./view.js";

export const spaceUserAvatarElementName = "vc-space-user-avatar" as const;
export const spaceUserNameElementName = "vc-space-user-name" as const;
export const spaceUserInfoCardElementName = "vc-space-user-info-card" as const;
export const spaceUserPresenceElementName = "vc-space-user-presence" as const;

export interface SpaceUserAvatarElement extends HTMLElement {
  user: SpaceUserIdentityView | null;
}

export interface SpaceUserNameElement extends HTMLElement {
  user: SpaceUserIdentityView | null;
}

export interface SpaceUserInfoCardElement extends HTMLElement {
  user: SpaceUserIdentityView | null;
}

export interface SpaceUserPresenceElement extends HTMLElement {
  user: SpaceUserIdentityView | null;
}


function documentLocale(element: HTMLElement) {
  return element.getAttribute("locale")
    || element.ownerDocument.documentElement.lang
    || "en";
}

function userFromAttributes(element: HTMLElement): SpaceUserIdentityView {
  const name = element.getAttribute("name")?.trim() || "Member";
  return {
    id: element.getAttribute("user-id") || "",
    name,
    handle: element.getAttribute("handle")?.trim() || null,
    avatarUrl: sanitizeSpaceMediaUrl(element.getAttribute("avatar-src")),
    presence: (element.getAttribute("presence") || "offline") as SpaceUserIdentityView["presence"],
  };
}

function applyAvatarAttributes(
  avatar: HTMLElement,
  user: SpaceUserIdentityView,
  size: SpaceAvatarSize,
  label: string,
) {
  avatar.setAttribute("name", user.name);
  avatar.setAttribute("size", size);
  avatar.setAttribute("status", user.presence);
  avatar.setAttribute("label", label);
  if (user.avatarUrl) avatar.setAttribute("src", user.avatarUrl);
}

export const spaceUserAvatarStyles = `
:host { display: inline-grid; vertical-align: middle; }
${spaceAvatarElementName} {
  --vc-space-avatar-signal: var(--vc-space-user-avatar-accent, var(--vc-space-color-accent, #d95835));
  --vc-space-avatar-paper: var(--vc-space-color-surface-raised, #fff);
  --vc-space-avatar-ink: var(--vc-space-color-text, #172026);
  --vc-space-avatar-online: var(--vc-space-color-positive, #438a5e);
  --vc-space-avatar-away: var(--vc-space-color-warning, #a86a16);
  --vc-space-avatar-offline: var(--vc-space-color-neutral, #77808a);
}
`;

function createSpaceUserAvatarElementClass() {
  return class VcSpaceUserAvatarElement extends HTMLElement implements SpaceUserAvatarElement {
    static readonly observedAttributes = ["avatar-src", "label", "locale", "name", "presence", "size", "user-id"];
    #user: SpaceUserIdentityView | null = null;

    get user() { return this.#user; }
    set user(value) {
      this.#user = value;
      if (this.isConnected) this.render();
    }

    connectedCallback() {
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      this.render();
    }

    attributeChangedCallback() {
      if (this.isConnected && !this.#user) this.render();
    }

    private render() {
      const root = this.shadowRoot;
      if (!root) return;
      const user = this.#user ?? userFromAttributes(this);
      const translate = createSpaceComponentTranslator(documentLocale(this));
      const label = this.getAttribute("label")?.trim()
        || translate("space.components.avatar.label", { name: user.name });
      const size = (this.getAttribute("size") || "md") as SpaceAvatarSize;
      const style = this.ownerDocument.createElement("style");
      style.textContent = spaceUserAvatarStyles;
      const avatar = this.ownerDocument.createElement(spaceAvatarElementName);
      avatar.setAttribute("part", "avatar");
      applyAvatarAttributes(avatar, user, size, label);
      root.replaceChildren(style, avatar);
    }
  };
}

export const spaceUserNameStyles = `
:host {
  display: inline-grid;
  min-inline-size: 0;
  gap: .08rem;
  color: var(--vc-space-color-text, #172026);
  font-family: var(--vc-space-font-body, sans-serif);
}
.name {
  min-inline-size: 0;
  font-size: var(--vc-space-text-body-size, 1rem);
  font-weight: 760;
  line-height: 1.2;
  overflow-wrap: anywhere;
}
.handle {
  min-inline-size: 0;
  color: var(--vc-space-color-text-muted, #5d6670);
  font-size: var(--vc-space-text-caption-size, .78rem);
  font-weight: 560;
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.handle[hidden] { display: none; }
:host([truncate]) .name,
:host([truncate]) .handle { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@media (forced-colors: active), (prefers-contrast: more) {
  .handle { color: CanvasText; }
}
`;

function createSpaceUserNameElementClass() {
  return class VcSpaceUserNameElement extends HTMLElement implements SpaceUserNameElement {
    static readonly observedAttributes = ["handle", "name", "truncate", "user-id"];
    #user: SpaceUserIdentityView | null = null;

    get user() { return this.#user; }
    set user(value) {
      this.#user = value;
      if (this.isConnected) this.render();
    }

    connectedCallback() {
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      this.render();
    }

    attributeChangedCallback() {
      if (this.isConnected && !this.#user) this.render();
    }

    private render() {
      const root = this.shadowRoot;
      if (!root) return;
      const user = this.#user ?? userFromAttributes(this);
      const style = this.ownerDocument.createElement("style");
      style.textContent = spaceUserNameStyles;
      const name = this.ownerDocument.createElement("span");
      name.className = "name";
      name.setAttribute("part", "name");
      name.textContent = user.name;
      const handle = this.ownerDocument.createElement("span");
      handle.className = "handle";
      handle.setAttribute("part", "handle");
      handle.hidden = !user.handle;
      handle.textContent = user.handle ? `@${user.handle.replace(/^@/, "")}` : "";
      root.replaceChildren(style, name, handle);
    }
  };
}

export const spaceUserInfoCardStyles = `
:host {
  display: block;
  min-inline-size: 0;
  container-type: inline-size;
  color: var(--vc-space-color-text, #172026);
  font-family: var(--vc-space-font-body, sans-serif);
}
.card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: var(--vc-space-gap-md, .9rem);
  align-items: center;
  padding: var(--vc-space-card-padding, 1rem);
  border: 1px solid var(--vc-space-color-border, #8a929a);
  border-radius: var(--vc-space-radius-card, .9rem);
  background: var(--vc-space-color-surface-raised, #fff);
}
.identity { display: grid; min-inline-size: 0; gap: .45rem; }
.presence { justify-self: start; }
:host([density="compact"]) .card {
  --vc-space-card-padding: .72rem;
  --vc-space-gap-md: .68rem;
}
@container (max-width: 22rem) {
  .card { grid-template-columns: minmax(0, 1fr); align-items: start; }
  .actions { grid-column: 1; justify-self: start; }
}
@media (max-width: 24rem) {
  .card { grid-template-columns: minmax(0, 1fr); align-items: start; }
  .actions { grid-column: 1; justify-self: start; }
}
@media (forced-colors: active), (prefers-contrast: more) {
  .card { border: 2px solid CanvasText; }
}
`;

function createSpaceUserInfoCardElementClass() {
  return class VcSpaceUserInfoCardElement extends HTMLElement implements SpaceUserInfoCardElement {
    static readonly observedAttributes = ["avatar-src", "density", "handle", "locale", "name", "presence", "user-id"];
    #user: SpaceUserIdentityView | null = null;

    get user() { return this.#user; }
    set user(value) {
      this.#user = value;
      if (this.isConnected) this.render();
    }

    connectedCallback() {
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      this.render();
    }

    attributeChangedCallback() {
      if (this.isConnected && !this.#user) this.render();
    }

    private render() {
      const root = this.shadowRoot;
      if (!root) return;
      const user = this.#user ?? userFromAttributes(this);
      const translate = createSpaceComponentTranslator(documentLocale(this));
      const cardLabel = translate("space.components.user.card.label", { name: user.name });
      const avatarLabel = translate("space.components.avatar.label", { name: user.name });
      const presenceLabel = translate(`space.components.presence.${user.presence}`);
      this.setAttribute("role", "group");
      this.setAttribute("aria-label", cardLabel);

      const style = this.ownerDocument.createElement("style");
      style.textContent = spaceUserInfoCardStyles;
      const card = this.ownerDocument.createElement("article");
      card.className = "card";
      card.setAttribute("part", "card");
      const avatar = this.ownerDocument.createElement(spaceUserAvatarElementName) as SpaceUserAvatarElement;
      avatar.setAttribute("part", "avatar");
      avatar.setAttribute("label", avatarLabel);
      avatar.user = user;
      const identity = this.ownerDocument.createElement("div");
      identity.className = "identity";
      identity.setAttribute("part", "identity");
      const name = this.ownerDocument.createElement(spaceUserNameElementName) as SpaceUserNameElement;
      name.user = user;
      const presence = this.ownerDocument.createElement(spaceStatusDotElementName);
      presence.className = "presence";
      presence.setAttribute("status", user.presence);
      presence.setAttribute("label", presenceLabel);
      presence.setAttribute("show-label", "");
      identity.append(name, presence);
      const actions = this.ownerDocument.createElement("slot");
      actions.className = "actions";
      actions.name = "actions";
      card.append(avatar, identity, actions);
      root.replaceChildren(style, card);
    }
  };
}

export const spaceUserPresenceStyles = `
:host { display:inline-flex; min-inline-size:0; vertical-align:middle; }
${spaceStatusDotElementName} { min-inline-size:0; }
@media (forced-colors:active),(prefers-contrast:more) {
  :host { color:CanvasText; }
}
`;

function createSpaceUserPresenceElementClass() {
  return class VcSpaceUserPresenceElement extends HTMLElement implements SpaceUserPresenceElement {
    static readonly observedAttributes = ["locale", "name", "presence", "user-id"];
    #user: SpaceUserIdentityView | null = null;

    get user() { return this.#user; }
    set user(value) {
      this.#user = value;
      if (this.isConnected) this.render();
    }

    connectedCallback() {
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      this.render();
    }

    attributeChangedCallback() {
      if (this.isConnected && !this.#user) this.render();
    }

    private render() {
      const root = this.shadowRoot;
      if (!root) return;
      const user = this.#user ?? userFromAttributes(this);
      const translate = createSpaceComponentTranslator(documentLocale(this));
      const presenceLabel = translate(`space.components.presence.${user.presence}`);
      this.setAttribute("role", "status");
      this.setAttribute("aria-label", translate("space.components.user.presence.label", {
        name: user.name,
        status: presenceLabel,
      }));
      const style = this.ownerDocument.createElement("style");
      style.textContent = spaceUserPresenceStyles;
      const presence = this.ownerDocument.createElement(spaceStatusDotElementName);
      presence.setAttribute("part", "status");
      presence.setAttribute("status", user.presence);
      presence.setAttribute("label", presenceLabel);
      presence.setAttribute("show-label", "");
      root.replaceChildren(style, presence);
    }
  };
}

export function renderSpaceUserInfoCard(user: SpaceUserIdentityView) {
  const attributes = [
    `user-id="${escapeSpaceAttribute(user.id)}"`,
    `name="${escapeSpaceAttribute(user.name)}"`,
    `presence="${user.presence}"`,
  ];
  if (user.handle) attributes.push(`handle="${escapeSpaceAttribute(user.handle)}"`);
  if (user.avatarUrl) attributes.push(`avatar-src="${escapeSpaceAttribute(user.avatarUrl)}"`);
  return `<${spaceUserInfoCardElementName} ${attributes.join(" ")}></${spaceUserInfoCardElementName}>`;
}

export function defineSpaceUserIdentityElements(
  registry: SpaceElementRegistry | undefined = globalThis.customElements,
) {
  if (!registry || typeof globalThis.HTMLElement !== "function") return false;
  defineSpaceAvatarElement(registry);
  defineSpaceStatusDotElement(registry);
  defineSpaceElement(registry, spaceUserAvatarElementName, createSpaceUserAvatarElementClass);
  defineSpaceElement(registry, spaceUserNameElementName, createSpaceUserNameElementClass);
  defineSpaceElement(registry, spaceUserInfoCardElementName, createSpaceUserInfoCardElementClass);
  defineSpaceElement(registry, spaceUserPresenceElementName, createSpaceUserPresenceElementClass);
  return true;
}
