import { createSpaceComponentTranslator } from "../core/context.js";
import { defineSpaceElement, type SpaceElementRegistry } from "../foundation/element.js";
import { sanitizeSpaceMediaUrl } from "../foundation/safety.js";
import {
  defineSpaceUserIdentityElements,
  spaceUserAvatarElementName,
  spaceUserNameElementName,
  spaceUserPresenceElementName,
  type SpaceUserAvatarElement,
  type SpaceUserNameElement,
  type SpaceUserPresenceElement,
} from "./elements.js";
import type { SpaceUserIdentityView } from "./view.js";

export const spaceMemberListItemElementName = "vc-space-member-list-item" as const;
export const spaceMemberListElementName = "vc-space-member-list" as const;

export const spaceUserEventNames = Object.freeze({
  memberSelect: "vc-space-member-select",
} as const);

export interface SpaceUserComponentEventDetailMap {
  [spaceUserEventNames.memberSelect]: { user: SpaceUserIdentityView };
}

export type SpaceUserComponentEventName = keyof SpaceUserComponentEventDetailMap;
export type SpaceUserComponentEvent<Name extends SpaceUserComponentEventName> =
  CustomEvent<SpaceUserComponentEventDetailMap[Name]>;

export interface SpaceMemberListItemElement extends HTMLElement {
  user: SpaceUserIdentityView | null;
  selected: boolean;
  disabled: boolean;
}

export interface SpaceMemberListElement extends HTMLElement {
  users: readonly SpaceUserIdentityView[];
  selectedUserId: string | null;
  disabledUserIds: readonly string[];
  focusFirst(): void;
}

function documentLocale(element: HTMLElement) {
  return element.getAttribute("locale")
    || element.ownerDocument.documentElement.lang
    || "en";
}

function userFromAttributes(element: HTMLElement): SpaceUserIdentityView {
  return {
    id: element.getAttribute("user-id") || "",
    name: element.getAttribute("name")?.trim() || "Member",
    handle: element.getAttribute("handle")?.trim() || null,
    avatarUrl: sanitizeSpaceMediaUrl(element.getAttribute("avatar-src")),
    presence: (element.getAttribute("presence") || "offline") as SpaceUserIdentityView["presence"],
  };
}

function emitUserEvent<Name extends SpaceUserComponentEventName>(
  element: HTMLElement,
  name: Name,
  detail: SpaceUserComponentEventDetailMap[Name],
) {
  return element.dispatchEvent(new CustomEvent(name, {
    bubbles: true,
    composed: true,
    detail,
  }));
}

export const spaceMemberListItemStyles = `
:host {
  display:block;
  min-inline-size:0;
  container-type:inline-size;
  color:var(--vc-space-color-text,#172026);
  font-family:var(--vc-space-font-body,sans-serif);
}
.row {
  display:grid;
  grid-template-columns:auto minmax(0,1fr) auto;
  gap:var(--vc-space-gap-sm,.7rem);
  align-items:center;
  min-inline-size:0;
  padding:.58rem .62rem;
  border:1px solid transparent;
  border-radius:var(--vc-space-radius-control,.65rem);
  transition:background-color 140ms ease,border-color 140ms ease;
}
.identity { display:grid; min-inline-size:0; }
${spaceUserNameElementName},${spaceUserPresenceElementName} { min-inline-size:0; }
:host([selected]) .row {
  border-color:var(--vc-space-color-accent,#d95835);
  background:color-mix(in srgb,var(--vc-space-color-accent,#d95835) 11%,transparent);
}
:host([disabled]) { opacity:.55; }
:host([density="compact"]) .row { gap:.5rem; padding:.4rem .48rem; }
@container (max-width:22rem) {
  .row { grid-template-columns:minmax(0,1fr); align-items:start; }
  ${spaceUserAvatarElementName},${spaceUserPresenceElementName} { grid-column:1; justify-self:start; }
}
@media (max-width:24rem) {
  .row { grid-template-columns:minmax(0,1fr); align-items:start; }
  ${spaceUserAvatarElementName},${spaceUserPresenceElementName} { grid-column:1; justify-self:start; }
}
@media (prefers-reduced-motion:reduce) { .row { transition:none; } }
@media (forced-colors:active),(prefers-contrast:more) {
  :host([selected]) .row { border:2px solid Highlight; background:Canvas; color:CanvasText; }
}
`;

function createSpaceMemberListItemElementClass() {
  return class VcSpaceMemberListItemElement extends HTMLElement implements SpaceMemberListItemElement {
    static readonly observedAttributes = [
      "avatar-src", "density", "disabled", "handle", "locale", "name",
      "presence", "selected", "user-id",
    ];
    #user: SpaceUserIdentityView | null = null;

    get user() { return this.#user; }
    set user(value) {
      this.#user = value;
      if (this.isConnected) this.render();
    }
    get selected() { return this.hasAttribute("selected"); }
    set selected(value) { this.toggleAttribute("selected", Boolean(value)); }
    get disabled() { return this.hasAttribute("disabled"); }
    set disabled(value) { this.toggleAttribute("disabled", Boolean(value)); }

    connectedCallback() {
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      this.render();
    }

    attributeChangedCallback() {
      if (this.isConnected) this.render();
    }

    private render() {
      const root = this.shadowRoot;
      if (!root) return;
      const user = this.#user ?? userFromAttributes(this);
      const translate = createSpaceComponentTranslator(documentLocale(this));
      const style = this.ownerDocument.createElement("style");
      style.textContent = spaceMemberListItemStyles;
      const row = this.ownerDocument.createElement("span");
      row.className = "row";
      row.setAttribute("part", "row");
      const avatar = this.ownerDocument.createElement(spaceUserAvatarElementName) as SpaceUserAvatarElement;
      avatar.setAttribute("part", "avatar");
      avatar.setAttribute("size", this.getAttribute("density") === "compact" ? "sm" : "md");
      avatar.setAttribute("label", translate("space.components.avatar.label", { name: user.name }));
      avatar.user = user;
      const identity = this.ownerDocument.createElement("span");
      identity.className = "identity";
      identity.setAttribute("part", "identity");
      const name = this.ownerDocument.createElement(spaceUserNameElementName) as SpaceUserNameElement;
      name.user = user;
      identity.append(name);
      const presence = this.ownerDocument.createElement(spaceUserPresenceElementName) as SpaceUserPresenceElement;
      presence.user = user;
      presence.setAttribute("part", "presence");
      row.append(avatar, identity, presence);
      root.replaceChildren(style, row);
    }
  };
}

export const spaceMemberListStyles = `
:host { display:block; min-inline-size:0; color:var(--vc-space-color-text,#172026); font-family:var(--vc-space-font-body,sans-serif); }
.list { display:grid; min-inline-size:0; gap:.18rem; }
.list[hidden],.empty[hidden] { display:none; }
button {
  display:block;
  inline-size:100%;
  min-inline-size:0;
  min-block-size:44px;
  padding:0;
  border:1px solid transparent;
  border-radius:var(--vc-space-radius-control,.72rem);
  color:inherit;
  background:transparent;
  text-align:start;
  cursor:pointer;
}
button:hover { background:var(--vc-space-color-surface,#f5f2eb); }
button:focus-visible { outline:3px solid var(--vc-space-color-focus,#2366d1); outline-offset:2px; }
button:disabled { cursor:not-allowed; opacity:.7; }
.empty {
  min-block-size:44px;
  padding:.75rem;
  border:1px dashed var(--vc-space-color-border,#8a929a);
  border-radius:var(--vc-space-radius-control,.72rem);
  color:var(--vc-space-color-text-muted,#5d6670);
  overflow-wrap:anywhere;
}
@media (prefers-reduced-motion:reduce) { button { scroll-behavior:auto; } }
@media (forced-colors:active),(prefers-contrast:more) {
  button:focus-visible,.empty { border:2px solid CanvasText; background:Canvas; color:CanvasText; }
  button[aria-selected="true"] { border-color:Highlight; }
}
`;

function createSpaceMemberListElementClass() {
  return class VcSpaceMemberListElement extends HTMLElement implements SpaceMemberListElement {
    static readonly observedAttributes = ["density", "disabled", "locale", "selected-user-id"];
    #users: readonly SpaceUserIdentityView[] = Object.freeze([]);
    #disabledUserIds: readonly string[] = Object.freeze([]);

    get users() { return this.#users; }
    set users(value) {
      this.#users = Object.freeze([...(value ?? [])]);
      if (this.isConnected) this.render();
    }
    get selectedUserId() { return this.getAttribute("selected-user-id")?.trim() || null; }
    set selectedUserId(value) {
      if (value) this.setAttribute("selected-user-id", value);
      else this.removeAttribute("selected-user-id");
    }
    get disabledUserIds() { return this.#disabledUserIds; }
    set disabledUserIds(value) {
      this.#disabledUserIds = Object.freeze([...(value ?? [])]);
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
      const translate = createSpaceComponentTranslator(documentLocale(this));
      const style = this.ownerDocument.createElement("style");
      style.textContent = spaceMemberListStyles;
      const list = this.ownerDocument.createElement("div");
      list.className = "list";
      list.hidden = this.#users.length === 0;
      list.setAttribute("part", "list");
      list.setAttribute("role", "listbox");
      list.setAttribute("aria-label", translate("space.components.user.members.label"));
      const disabledIds = new Set(this.#disabledUserIds);
      const disabledAll = this.hasAttribute("disabled");
      const selectedId = this.selectedUserId;
      const hasEnabledSelection = this.#users.some((user) =>
        user.id === selectedId && !disabledAll && !disabledIds.has(user.id));
      const focusAt = (current: HTMLButtonElement, offset: number | "first" | "last") => {
        const buttons = Array.from(list.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
        if (buttons.length === 0) return;
        const index = Math.max(0, buttons.indexOf(current));
        const next = offset === "first"
          ? buttons[0]
          : offset === "last"
            ? buttons[buttons.length - 1]
            : buttons[(index + offset + buttons.length) % buttons.length];
        for (const button of buttons) button.tabIndex = button === next ? 0 : -1;
        next?.focus();
      };
      let hasTabStop = false;
      for (const user of this.#users) {
        const button = this.ownerDocument.createElement("button");
        const disabled = disabledAll || disabledIds.has(user.id);
        const selected = user.id === selectedId;
        button.type = "button";
        button.disabled = disabled;
        button.setAttribute("role", "option");
        button.setAttribute("part", "option");
        button.setAttribute("aria-selected", String(selected));
        const status = translate(`space.components.presence.${user.presence}`);
        button.setAttribute("aria-label", user.handle
          ? translate("space.components.user.member.handle-label", {
              name: user.name,
              handle: `@${user.handle.replace(/^@/, "")}`,
              status,
            })
          : translate("space.components.user.member.label", {
              name: user.name,
              status,
            }));
        button.tabIndex = !disabled
          && (selected || (!hasEnabledSelection && !hasTabStop)) ? 0 : -1;
        if (button.tabIndex === 0) hasTabStop = true;
        const item = this.ownerDocument.createElement(spaceMemberListItemElementName) as SpaceMemberListItemElement;
        item.user = user;
        item.selected = selected;
        item.disabled = disabled;
        item.setAttribute("part", "item");
        const density = this.getAttribute("density");
        if (density) item.setAttribute("density", density);
        button.append(item);
        button.addEventListener("click", () => {
          emitUserEvent(this, spaceUserEventNames.memberSelect, { user });
        });
        button.addEventListener("keydown", (event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            focusAt(button, event.key === "ArrowDown" ? 1 : -1);
          } else if (event.key === "Home" || event.key === "End") {
            event.preventDefault();
            focusAt(button, event.key === "Home" ? "first" : "last");
          }
        });
        list.append(button);
      }
      const empty = this.ownerDocument.createElement("div");
      empty.className = "empty";
      empty.hidden = this.#users.length > 0;
      empty.setAttribute("part", "empty");
      empty.setAttribute("role", "status");
      empty.textContent = translate("space.components.user.members.empty");
      root.replaceChildren(style, list, empty);
    }
  };
}

export function defineSpaceUserDirectoryElements(
  registry: SpaceElementRegistry | undefined = globalThis.customElements,
) {
  if (!registry || typeof globalThis.HTMLElement !== "function") return false;
  defineSpaceUserIdentityElements(registry);
  defineSpaceElement(registry, spaceMemberListItemElementName, createSpaceMemberListItemElementClass);
  defineSpaceElement(registry, spaceMemberListElementName, createSpaceMemberListElementClass);
  return true;
}
