import type { SpaceMentionTarget } from "@vibechat/space-app-sdk";

import { createSpaceComponentTranslator } from "../core/context.js";
import {
  defineSpaceElements as defineSpaceAvatarElement,
  spaceAvatarElementName,
} from "../foundation/avatar.js";
import { defineSpaceElement, type SpaceElementRegistry } from "../foundation/element.js";

export const spaceMentionTargetItemElementName = "vc-space-mention-target-item" as const;

export interface SpaceMentionTargetItemElement extends HTMLElement {
  target: SpaceMentionTarget | null;
}

function documentLocale(element: HTMLElement) {
  return element.getAttribute("locale")
    || element.ownerDocument.documentElement.lang
    || "en";
}

function mentionTargetFromAttributes(element: HTMLElement): SpaceMentionTarget {
  return {
    id: element.getAttribute("target-id") || "",
    handle: element.getAttribute("handle")?.trim() || "member",
    name: element.getAttribute("name")?.trim() || "Member",
    type: element.getAttribute("type") === "agent" ? "agent" : "member",
    available: element.getAttribute("available") !== "false",
  };
}

export const spaceMentionTargetItemStyles = `
:host {
  display:block;
  min-inline-size:0;
  container-type:inline-size;
  color:var(--vc-space-color-text,#172026);
  font-family:var(--vc-space-font-body,sans-serif);
}
.target { display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:.65rem; align-items:center; min-inline-size:0; }
.identity { display:grid; min-inline-size:0; gap:.08rem; }
.name,.handle,.kind { min-inline-size:0; overflow-wrap:anywhere; }
.name { font-weight:760; line-height:1.25; }
.handle,.kind { color:var(--vc-space-color-text-muted,#5d6670); font-size:var(--vc-space-text-caption-size,.75rem); line-height:1.3; }
.kind { justify-self:end; text-align:end; }
:host([available="false"]) .target { opacity:.68; }
@container (max-width:22rem) {
  .target { grid-template-columns:minmax(0,1fr); align-items:start; }
  .kind { grid-column:1; justify-self:start; text-align:start; }
}
@media (max-width:24rem) { .target { grid-template-columns:minmax(0,1fr); align-items:start; } .kind { grid-column:1; justify-self:start; text-align:start; } }
@media (forced-colors:active),(prefers-contrast:more) { .handle,.kind { color:CanvasText; } }
`;

function createSpaceMentionTargetItemElementClass() {
  return class VcSpaceMentionTargetItemElement extends HTMLElement implements SpaceMentionTargetItemElement {
    static readonly observedAttributes = ["available", "handle", "locale", "name", "target-id", "type"];
    #target: SpaceMentionTarget | null = null;

    get target() { return this.#target; }
    set target(value) {
      this.#target = value;
      if (this.isConnected) this.render();
    }

    connectedCallback() {
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      this.render();
    }

    attributeChangedCallback() {
      if (this.isConnected && !this.#target) this.render();
    }

    private render() {
      const root = this.shadowRoot;
      if (!root) return;
      const target = this.#target ?? mentionTargetFromAttributes(this);
      const translate = createSpaceComponentTranslator(documentLocale(this));
      const kindLabel = translate(`space.components.mention.${target.type}`);
      const availableLabel = target.available === false
        ? translate("space.components.mention.unavailable")
        : kindLabel;
      this.setAttribute("role", "group");
      const available = String(target.available !== false);
      if (this.getAttribute("available") !== available) {
        this.setAttribute("available", available);
      }
      this.setAttribute("aria-disabled", String(target.available === false));
      this.setAttribute("aria-label", translate("space.components.mention.target.label", {
        name: target.name,
        handle: `@${target.handle.replace(/^@/, "")}`,
        kind: availableLabel,
      }));
      const style = this.ownerDocument.createElement("style");
      style.textContent = spaceMentionTargetItemStyles;
      const row = this.ownerDocument.createElement("span");
      row.className = "target";
      row.setAttribute("part", "target");
      const avatar = this.ownerDocument.createElement(spaceAvatarElementName);
      avatar.setAttribute("part", "avatar");
      avatar.setAttribute("name", target.name);
      avatar.setAttribute("size", "sm");
      avatar.setAttribute("label", translate("space.components.avatar.label", { name: target.name }));
      const identity = this.ownerDocument.createElement("span");
      identity.className = "identity";
      identity.setAttribute("part", "identity");
      const name = this.ownerDocument.createElement("strong");
      name.className = "name";
      name.setAttribute("part", "name");
      name.textContent = target.name;
      const handle = this.ownerDocument.createElement("span");
      handle.className = "handle";
      handle.setAttribute("part", "handle");
      handle.textContent = `@${target.handle.replace(/^@/, "")}`;
      identity.append(name, handle);
      const kind = this.ownerDocument.createElement("span");
      kind.className = "kind";
      kind.setAttribute("part", "kind");
      kind.textContent = availableLabel;
      row.append(avatar, identity, kind);
      root.replaceChildren(style, row);
    }
  };
}

export function defineSpaceMentionTargetItemElement(
  registry: SpaceElementRegistry | undefined = globalThis.customElements,
) {
  if (!registry || typeof globalThis.HTMLElement !== "function") return false;
  defineSpaceAvatarElement(registry);
  defineSpaceElement(
    registry,
    spaceMentionTargetItemElementName,
    createSpaceMentionTargetItemElementClass,
  );
  return true;
}
