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
import type { SpaceAgentIdentityView, SpaceAgentStatus } from "./view.js";
import { defineSpaceAgentActivityElements } from "./activity-elements.js";

export const spaceAgentAvatarElementName = "vc-space-agent-avatar" as const;
export const spaceAgentBadgeElementName = "vc-space-agent-badge" as const;
export const spaceAgentStatusElementName = "vc-space-agent-status" as const;
export const spaceAgentCardElementName = "vc-space-agent-card" as const;

export interface SpaceAgentAvatarElement extends HTMLElement {
  agent: SpaceAgentIdentityView | null;
}

export interface SpaceAgentStatusElement extends HTMLElement {
  agent: SpaceAgentIdentityView | null;
}

export interface SpaceAgentCardElement extends HTMLElement {
  agent: SpaceAgentIdentityView | null;
}

function documentLocale(element: HTMLElement) {
  return element.getAttribute("locale")
    || element.ownerDocument.documentElement.lang
    || "en";
}

function parseCount(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function agentFromAttributes(element: HTMLElement): SpaceAgentIdentityView {
  return {
    id: element.getAttribute("agent-id") || "",
    name: element.getAttribute("name")?.trim() || "Agent",
    avatarUrl: sanitizeSpaceMediaUrl(element.getAttribute("avatar-src")),
    status: (element.getAttribute("status") || "idle") as SpaceAgentStatus,
    summary: element.getAttribute("summary")?.trim() || null,
    activeCount: parseCount(element.getAttribute("active-count")),
    pendingCount: parseCount(element.getAttribute("pending-count")),
  };
}

export const spaceAgentAvatarStyles = `
:host { display: inline-grid; position: relative; vertical-align: middle; }
${spaceAvatarElementName} {
  --vc-space-avatar-signal: var(--vc-space-agent-avatar-accent, var(--vc-space-color-accent, #d95835));
  --vc-space-avatar-paper: var(--vc-space-color-surface-raised, #fff);
  --vc-space-avatar-ink: var(--vc-space-color-text, #172026);
}
.mark {
  position: absolute;
  top: -.1rem;
  right: -.12rem;
  inline-size: max(.66rem, calc(var(--vc-space-avatar-size, 2.75rem) * .22));
  block-size: max(.66rem, calc(var(--vc-space-avatar-size, 2.75rem) * .22));
  border: 2px solid var(--vc-space-color-surface-raised, #fff);
  border-radius: .18rem;
  background: var(--vc-space-color-accent, #d95835);
  transform: rotate(45deg);
  box-shadow: 0 .16rem .42rem color-mix(in srgb, var(--vc-space-color-text, #172026) 24%, transparent);
}
@media (forced-colors: active), (prefers-contrast: more) {
  .mark { border-color: Canvas; outline: 2px solid CanvasText; background: Highlight; }
}
`;

function createSpaceAgentAvatarElementClass() {
  return class VcSpaceAgentAvatarElement extends HTMLElement implements SpaceAgentAvatarElement {
    static readonly observedAttributes = ["agent-id", "avatar-src", "label", "locale", "name", "size"];
    #agent: SpaceAgentIdentityView | null = null;

    get agent() { return this.#agent; }
    set agent(value) {
      this.#agent = value;
      if (this.isConnected) this.render();
    }

    connectedCallback() {
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      this.render();
    }

    attributeChangedCallback() {
      if (this.isConnected && !this.#agent) this.render();
    }

    private render() {
      const root = this.shadowRoot;
      if (!root) return;
      const agent = this.#agent ?? agentFromAttributes(this);
      const translate = createSpaceComponentTranslator(documentLocale(this));
      const label = this.getAttribute("label")?.trim()
        || translate("space.components.agent.avatar.label", { name: agent.name });
      const size = (this.getAttribute("size") || "md") as SpaceAvatarSize;
      const style = this.ownerDocument.createElement("style");
      style.textContent = spaceAgentAvatarStyles;
      const avatar = this.ownerDocument.createElement(spaceAvatarElementName);
      avatar.setAttribute("name", agent.name);
      avatar.setAttribute("size", size);
      avatar.setAttribute("status", "none");
      avatar.setAttribute("label", label);
      avatar.setAttribute("part", "avatar");
      if (agent.avatarUrl) avatar.setAttribute("src", agent.avatarUrl);
      const mark = this.ownerDocument.createElement("span");
      mark.className = "mark";
      mark.setAttribute("part", "mark");
      mark.setAttribute("aria-hidden", "true");
      root.replaceChildren(style, avatar, mark);
    }
  };
}

export const spaceAgentBadgeStyles = `
:host {
  display: inline-flex;
  align-items: center;
  gap: .32rem;
  max-inline-size: 100%;
  padding: .18rem .48rem;
  border: 1px solid color-mix(in srgb, var(--vc-space-color-accent, #d95835) 52%, var(--vc-space-color-border, #8a929a));
  border-radius: 999px;
  color: var(--vc-space-color-accent-contrast, #fff);
  background: var(--vc-space-color-accent, #d95835);
  font: 760 var(--vc-space-text-caption-size, .7rem) / 1.2 var(--vc-space-font-body, sans-serif);
  letter-spacing: .045em;
  text-transform: uppercase;
}
.mark { inline-size: .42rem; block-size: .42rem; border: 1px solid currentColor; transform: rotate(45deg); }
.label { overflow-wrap: anywhere; }
@media (forced-colors: active), (prefers-contrast: more) {
  :host { border: 2px solid CanvasText; color: CanvasText; background: Canvas; }
}
`;

function createSpaceAgentBadgeElementClass() {
  return class VcSpaceAgentBadgeElement extends HTMLElement {
    static readonly observedAttributes = ["label", "locale"];
    connectedCallback() {
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      this.render();
    }
    attributeChangedCallback() { if (this.isConnected) this.render(); }
    private render() {
      const root = this.shadowRoot;
      if (!root) return;
      const translate = createSpaceComponentTranslator(documentLocale(this));
      const label = this.getAttribute("label")?.trim()
        || translate("space.components.agent.badge");
      const style = this.ownerDocument.createElement("style");
      style.textContent = spaceAgentBadgeStyles;
      const mark = this.ownerDocument.createElement("span");
      mark.className = "mark";
      mark.setAttribute("aria-hidden", "true");
      const text = this.ownerDocument.createElement("span");
      text.className = "label";
      text.setAttribute("part", "label");
      text.textContent = label;
      root.replaceChildren(style, mark, text);
    }
  };
}

export const spaceAgentStatusStyles = `
:host {
  display: inline-flex;
  min-inline-size: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: .42rem .72rem;
  color: var(--vc-space-color-text-muted, #5d6670);
  font-family: var(--vc-space-font-body, sans-serif);
}
.queue {
  color: var(--vc-space-color-text-muted, #5d6670);
  font-size: var(--vc-space-text-caption-size, .75rem);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.queue[hidden] { display: none; }
@media (forced-colors: active), (prefers-contrast: more) {
  .queue { color: CanvasText; }
}
`;

function createSpaceAgentStatusElementClass() {
  return class VcSpaceAgentStatusElement extends HTMLElement implements SpaceAgentStatusElement {
    static readonly observedAttributes = ["active-count", "agent-id", "locale", "name", "pending-count", "status"];
    #agent: SpaceAgentIdentityView | null = null;

    get agent() { return this.#agent; }
    set agent(value) {
      this.#agent = value;
      if (this.isConnected) this.render();
    }

    connectedCallback() {
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      this.render();
    }

    attributeChangedCallback() {
      if (this.isConnected && !this.#agent) this.render();
    }

    private render() {
      const root = this.shadowRoot;
      if (!root) return;
      const agent = this.#agent ?? agentFromAttributes(this);
      const locale = documentLocale(this);
      const translate = createSpaceComponentTranslator(locale);
      const statusLabel = translate(`space.components.agent.status.${agent.status}`);
      const queueLabel = translate("space.components.agent.queue", {
        active: new Intl.NumberFormat(locale).format(agent.activeCount),
        pending: new Intl.NumberFormat(locale).format(agent.pendingCount),
      });
      const style = this.ownerDocument.createElement("style");
      style.textContent = spaceAgentStatusStyles;
      const status = this.ownerDocument.createElement(spaceStatusDotElementName);
      status.setAttribute("status", agent.status);
      status.setAttribute("label", statusLabel);
      status.setAttribute("show-label", "");
      status.setAttribute("part", "status");
      const queue = this.ownerDocument.createElement("span");
      queue.className = "queue";
      queue.setAttribute("part", "queue");
      queue.hidden = agent.activeCount === 0 && agent.pendingCount === 0;
      queue.textContent = queueLabel;
      root.replaceChildren(style, status, queue);
    }
  };
}

export const spaceAgentCardStyles = `
:host {
  display: block;
  min-inline-size: 0;
  color: var(--vc-space-color-text, #172026);
  font-family: var(--vc-space-font-body, sans-serif);
}
.card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: var(--vc-space-gap-md, .9rem);
  align-items: start;
  padding: var(--vc-space-card-padding, 1rem);
  border: 1px solid var(--vc-space-color-border, #8a929a);
  border-radius: var(--vc-space-radius-card, .9rem);
  background: var(--vc-space-color-surface-raised, #fff);
}
.identity { display: grid; min-inline-size: 0; gap: .52rem; }
.heading { display: flex; min-inline-size: 0; flex-wrap: wrap; gap: .45rem .62rem; align-items: center; }
.name { min-inline-size: 0; font-size: 1.05rem; font-weight: 780; line-height: 1.2; overflow-wrap: anywhere; }
.summary { margin: 0; color: var(--vc-space-color-text-muted, #5d6670); font-size: .84rem; line-height: 1.42; overflow-wrap: anywhere; }
.summary[hidden] { display: none; }
:host([density="compact"]) .card { --vc-space-card-padding: .72rem; --vc-space-gap-md: .68rem; }
@media (max-width: 24rem) {
  .card { grid-template-columns: auto minmax(0, 1fr); }
  .actions { grid-column: 1 / -1; justify-self: start; }
}
@media (forced-colors: active), (prefers-contrast: more) {
  .card { border: 2px solid CanvasText; }
  .summary { color: CanvasText; }
}
`;

function createSpaceAgentCardElementClass() {
  return class VcSpaceAgentCardElement extends HTMLElement implements SpaceAgentCardElement {
    static readonly observedAttributes = ["active-count", "agent-id", "avatar-src", "density", "locale", "name", "pending-count", "status", "summary"];
    #agent: SpaceAgentIdentityView | null = null;

    get agent() { return this.#agent; }
    set agent(value) {
      this.#agent = value;
      if (this.isConnected) this.render();
    }

    connectedCallback() {
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      this.render();
    }

    attributeChangedCallback() {
      if (this.isConnected && !this.#agent) this.render();
    }

    private render() {
      const root = this.shadowRoot;
      if (!root) return;
      const agent = this.#agent ?? agentFromAttributes(this);
      const translate = createSpaceComponentTranslator(documentLocale(this));
      this.setAttribute("role", "group");
      this.setAttribute(
        "aria-label",
        translate("space.components.agent.card.label", { name: agent.name }),
      );
      const style = this.ownerDocument.createElement("style");
      style.textContent = spaceAgentCardStyles;
      const card = this.ownerDocument.createElement("article");
      card.className = "card";
      card.setAttribute("part", "card");
      const avatar = this.ownerDocument.createElement(spaceAgentAvatarElementName) as SpaceAgentAvatarElement;
      avatar.agent = agent;
      const identity = this.ownerDocument.createElement("div");
      identity.className = "identity";
      identity.setAttribute("part", "identity");
      const heading = this.ownerDocument.createElement("div");
      heading.className = "heading";
      const name = this.ownerDocument.createElement("span");
      name.className = "name";
      name.setAttribute("part", "name");
      name.textContent = agent.name;
      const badge = this.ownerDocument.createElement(spaceAgentBadgeElementName);
      heading.append(name, badge);
      const status = this.ownerDocument.createElement(spaceAgentStatusElementName) as SpaceAgentStatusElement;
      status.agent = agent;
      const summary = this.ownerDocument.createElement("p");
      summary.className = "summary";
      summary.setAttribute("part", "summary");
      summary.hidden = !agent.summary;
      summary.textContent = agent.summary || "";
      identity.append(heading, status, summary);
      const actions = this.ownerDocument.createElement("slot");
      actions.className = "actions";
      actions.name = "actions";
      card.append(avatar, identity, actions);
      root.replaceChildren(style, card);
    }
  };
}

export function renderSpaceAgentCard(agent: SpaceAgentIdentityView) {
  const attributes = [
    `agent-id="${escapeSpaceAttribute(agent.id)}"`,
    `name="${escapeSpaceAttribute(agent.name)}"`,
    `status="${agent.status}"`,
    `active-count="${agent.activeCount}"`,
    `pending-count="${agent.pendingCount}"`,
  ];
  if (agent.avatarUrl) attributes.push(`avatar-src="${escapeSpaceAttribute(agent.avatarUrl)}"`);
  if (agent.summary) attributes.push(`summary="${escapeSpaceAttribute(agent.summary)}"`);
  return `<${spaceAgentCardElementName} ${attributes.join(" ")}></${spaceAgentCardElementName}>`;
}

export function defineSpaceAgentElements(
  registry: SpaceElementRegistry | undefined = globalThis.customElements,
) {
  if (!registry || typeof globalThis.HTMLElement !== "function") return false;
  defineSpaceAvatarElement(registry);
  defineSpaceStatusDotElement(registry);
  defineSpaceElement(registry, spaceAgentAvatarElementName, createSpaceAgentAvatarElementClass);
  defineSpaceElement(registry, spaceAgentBadgeElementName, createSpaceAgentBadgeElementClass);
  defineSpaceElement(registry, spaceAgentStatusElementName, createSpaceAgentStatusElementClass);
  defineSpaceElement(registry, spaceAgentCardElementName, createSpaceAgentCardElementClass);
  defineSpaceAgentActivityElements(registry);
  return true;
}
