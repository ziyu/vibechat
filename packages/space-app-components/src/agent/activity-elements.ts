import { createSpaceComponentTranslator } from "../core/context.js";
import { defineSpaceElement, type SpaceElementRegistry } from "../foundation/element.js";
import { escapeSpaceAttribute } from "../foundation/safety.js";
import type {
  SpaceAgentActivityItemStatus,
  SpaceAgentActivityView,
  SpaceAgentQueueView,
} from "./activity.js";

const agentAvatarElementName = "vc-space-agent-avatar";

interface AgentAvatarElement extends HTMLElement {
  agent: SpaceAgentActivityView["agent"] | null;
}

export const spaceAgentQueueStatusElementName =
  "vc-space-agent-queue-status" as const;
export const spaceAgentActivityElementName = "vc-space-agent-activity" as const;

export interface SpaceAgentQueueStatusElement extends HTMLElement {
  queue: SpaceAgentQueueView | null;
}

export interface SpaceAgentActivityElement extends HTMLElement {
  activity: SpaceAgentActivityView | null;
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

function queueFromAttributes(element: HTMLElement): SpaceAgentQueueView {
  return Object.freeze({
    activeCount: parseCount(element.getAttribute("active-count")),
    pendingCount: parseCount(element.getAttribute("pending-count")),
  });
}

function activityFromAttributes(element: HTMLElement): SpaceAgentActivityView {
  const activeCount = parseCount(element.getAttribute("active-count"));
  const pendingCount = parseCount(element.getAttribute("pending-count"));
  const status = element.getAttribute("status") as SpaceAgentActivityView["agent"]["status"]
    || (activeCount > 0 ? "working" : pendingCount > 0 ? "queued" : "idle");
  return Object.freeze({
    agent: Object.freeze({
      id: element.getAttribute("agent-id") || "",
      name: element.getAttribute("name")?.trim() || "Agent",
      avatarUrl: null,
      status,
      summary: null,
      activeCount,
      pendingCount,
    }),
    active: element.hasAttribute("active"),
    stage: element.getAttribute("stage")?.trim() || null,
    queue: Object.freeze({ activeCount, pendingCount }),
    activities: Object.freeze([]),
  });
}

export const spaceAgentQueueStatusStyles = `
:host {
  display: inline-flex;
  min-inline-size: 0;
  align-items: center;
  gap: .55rem;
  color: var(--vc-space-color-text-muted, #5d6670);
  font: 650 var(--vc-space-text-caption-size, .76rem) / 1.35 var(--vc-space-font-body, sans-serif);
  font-variant-numeric: tabular-nums;
}
.signal {
  inline-size: .56rem;
  block-size: .56rem;
  flex: 0 0 auto;
  border: 1px solid currentColor;
  border-radius: 50%;
  background: var(--vc-space-color-neutral, #77808a);
}
:host([data-active="true"]) .signal {
  background: var(--vc-space-color-positive, #438a5e);
  box-shadow: 0 0 0 .22rem color-mix(in srgb, var(--vc-space-color-positive, #438a5e) 18%, transparent);
}
.label { min-inline-size: 0; overflow-wrap: anywhere; }
@media (prefers-reduced-motion: no-preference) {
  :host([data-active="true"]) .signal { animation: vc-space-agent-pulse 1.8s ease-in-out infinite; }
}
@keyframes vc-space-agent-pulse {
  50% { transform: scale(.78); box-shadow: 0 0 0 .38rem transparent; }
}
@media (forced-colors: active), (prefers-contrast: more) {
  :host { color: CanvasText; }
  .signal { border: 2px solid CanvasText; background: Canvas; box-shadow: none; }
  :host([data-active="true"]) .signal { background: Highlight; box-shadow: none; }
}
`;

function createSpaceAgentQueueStatusElementClass() {
  return class VcSpaceAgentQueueStatusElement extends HTMLElement implements SpaceAgentQueueStatusElement {
    static readonly observedAttributes = ["active-count", "locale", "pending-count", "quiet"];
    #queue: SpaceAgentQueueView | null = null;

    get queue() { return this.#queue; }
    set queue(value) {
      this.#queue = value;
      if (this.isConnected) this.render();
    }

    connectedCallback() {
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      this.render();
    }

    attributeChangedCallback() {
      if (this.isConnected && !this.#queue) this.render();
    }

    private render() {
      const root = this.shadowRoot;
      if (!root) return;
      const queue = this.#queue ?? queueFromAttributes(this);
      const locale = documentLocale(this);
      const translate = createSpaceComponentTranslator(locale);
      const label = translate("space.components.agent.queue", {
        active: new Intl.NumberFormat(locale).format(queue.activeCount),
        pending: new Intl.NumberFormat(locale).format(queue.pendingCount),
      });
      this.dataset.active = String(queue.activeCount > 0);
      if (this.hasAttribute("quiet")) {
        this.removeAttribute("role");
        this.removeAttribute("aria-live");
      } else {
        this.setAttribute("role", "status");
        this.setAttribute("aria-live", "polite");
        this.setAttribute("aria-atomic", "true");
      }

      const style = this.ownerDocument.createElement("style");
      style.textContent = spaceAgentQueueStatusStyles;
      const signal = this.ownerDocument.createElement("span");
      signal.className = "signal";
      signal.setAttribute("part", "signal");
      signal.setAttribute("aria-hidden", "true");
      const text = this.ownerDocument.createElement("span");
      text.className = "label";
      text.setAttribute("part", "label");
      text.textContent = label;
      root.replaceChildren(style, signal, text);
    }
  };
}

function itemStatusLabel(
  translate: ReturnType<typeof createSpaceComponentTranslator>,
  status: SpaceAgentActivityItemStatus,
) {
  return translate(`space.components.agent.activity.status.${status}`);
}

export const spaceAgentActivityStyles = `
:host {
  display: block;
  min-inline-size: 0;
  color: var(--vc-space-color-text, #172026);
  font-family: var(--vc-space-font-body, sans-serif);
}
:host([hidden]) { display: none; }
.panel {
  position: relative;
  display: grid;
  min-inline-size: 0;
  gap: .9rem;
  padding: var(--vc-space-card-padding, 1rem);
  overflow: hidden;
  border: 1px solid var(--vc-space-color-border, #8a929a);
  border-radius: var(--vc-space-radius-card, .9rem);
  background: var(--vc-space-color-surface-raised, #fff);
}
.panel::before {
  content: "";
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  inline-size: .22rem;
  background: var(--vc-space-color-neutral, #77808a);
}
:host([data-active="true"]) .panel::before { background: var(--vc-space-color-accent, #d95835); }
.header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: .75rem;
  align-items: center;
}
.heading { display: grid; min-inline-size: 0; gap: .22rem; }
.eyebrow {
  color: var(--vc-space-color-text-muted, #5d6670);
  font-size: var(--vc-space-text-caption-size, .72rem);
  font-weight: 780;
  letter-spacing: .065em;
  line-height: 1.2;
  text-transform: uppercase;
}
.stage {
  min-inline-size: 0;
  font-size: 1rem;
  font-weight: 760;
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.activities {
  display: grid;
  gap: .52rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.activities[hidden] { display: none; }
.activity {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: .58rem;
  align-items: start;
  color: var(--vc-space-color-text-muted, #5d6670);
  font-size: .8rem;
  line-height: 1.42;
}
.activity-mark {
  inline-size: .58rem;
  block-size: .58rem;
  margin-block-start: .25rem;
  border: 1px solid currentColor;
  border-radius: 50%;
  background: transparent;
}
.activity[data-status="active"] .activity-mark { background: var(--vc-space-color-accent, #d95835); }
.activity[data-status="completed"] .activity-mark { background: var(--vc-space-color-positive, #438a5e); }
.activity[data-status="failed"] .activity-mark { background: var(--vc-space-color-negative, #a33b43); }
.activity-copy { min-inline-size: 0; overflow-wrap: anywhere; }
.activity-label { color: var(--vc-space-color-text, #172026); font-weight: 720; }
.activity-detail { margin-inline-start: .34rem; }
.live {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
:host([density="compact"]) .panel { --vc-space-card-padding: .72rem; gap: .68rem; }
@media (max-width: 24rem) {
  .panel { padding: .82rem; }
  .header { align-items: start; }
}
@media (forced-colors: active), (prefers-contrast: more) {
  .panel { border: 2px solid CanvasText; background: Canvas; }
  .panel::before { background: CanvasText; }
  .eyebrow, .activity { color: CanvasText; }
  .activity-mark { border: 2px solid CanvasText; }
  .activity[data-status="active"] .activity-mark,
  .activity[data-status="completed"] .activity-mark,
  .activity[data-status="failed"] .activity-mark { background: Highlight; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; }
}
`;

function createSpaceAgentActivityElementClass() {
  return class VcSpaceAgentActivityElement extends HTMLElement implements SpaceAgentActivityElement {
    static readonly observedAttributes = [
      "active",
      "active-count",
      "agent-id",
      "density",
      "locale",
      "name",
      "pending-count",
      "stage",
      "status",
    ];
    #activity: SpaceAgentActivityView | null = null;

    get activity() { return this.#activity; }
    set activity(value) {
      this.#activity = value;
      if (this.isConnected) this.render();
    }

    connectedCallback() {
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      this.render();
    }

    attributeChangedCallback() {
      if (this.isConnected && !this.#activity) this.render();
    }

    private render() {
      const root = this.shadowRoot;
      if (!root) return;
      const activity = this.#activity ?? activityFromAttributes(this);
      const translate = createSpaceComponentTranslator(documentLocale(this));
      const stage = activity.stage
        || translate(`space.components.agent.activity.${activity.agent.status}`);
      const queueLabel = translate("space.components.agent.queue", {
        active: activity.queue.activeCount,
        pending: activity.queue.pendingCount,
      });
      this.dataset.active = String(activity.active || activity.queue.activeCount > 0);
      this.setAttribute("role", "group");
      this.setAttribute(
        "aria-label",
        translate("space.components.agent.activity.label", {
          name: activity.agent.name,
        }),
      );

      const style = this.ownerDocument.createElement("style");
      style.textContent = spaceAgentActivityStyles;
      const panel = this.ownerDocument.createElement("section");
      panel.className = "panel";
      panel.setAttribute("part", "panel");
      const header = this.ownerDocument.createElement("header");
      header.className = "header";
      header.setAttribute("part", "header");
      const avatar = this.ownerDocument.createElement(agentAvatarElementName) as AgentAvatarElement;
      avatar.setAttribute("size", "sm");
      avatar.agent = activity.agent;
      const heading = this.ownerDocument.createElement("div");
      heading.className = "heading";
      const eyebrow = this.ownerDocument.createElement("span");
      eyebrow.className = "eyebrow";
      eyebrow.setAttribute("part", "eyebrow");
      eyebrow.textContent = translate("space.components.agent.activity.label", {
        name: activity.agent.name,
      });
      const stageElement = this.ownerDocument.createElement("span");
      stageElement.className = "stage";
      stageElement.setAttribute("part", "stage");
      stageElement.textContent = stage;
      heading.append(eyebrow, stageElement);
      header.append(avatar, heading);

      const queue = this.ownerDocument.createElement(spaceAgentQueueStatusElementName) as SpaceAgentQueueStatusElement;
      queue.setAttribute("quiet", "");
      queue.setAttribute("part", "queue");
      queue.queue = activity.queue;

      const activities = this.ownerDocument.createElement("ol");
      activities.className = "activities";
      activities.setAttribute("part", "activities");
      activities.hidden = activity.activities.length === 0;
      activity.activities.forEach((item, index) => {
        const row = this.ownerDocument.createElement("li");
        row.className = "activity";
        row.dataset.status = item.status;
        row.setAttribute("part", "activity");
        const mark = this.ownerDocument.createElement("span");
        mark.className = "activity-mark";
        mark.setAttribute("part", "activity-mark");
        mark.setAttribute("aria-hidden", "true");
        const copy = this.ownerDocument.createElement("span");
        copy.className = "activity-copy";
        const label = this.ownerDocument.createElement("span");
        label.className = "activity-label";
        label.setAttribute("part", "activity-label");
        label.textContent = item.label || translate("space.components.agent.activity.item", {
          position: index + 1,
        });
        const status = this.ownerDocument.createElement("span");
        status.className = "activity-detail";
        status.setAttribute("part", "activity-detail");
        status.textContent = item.detail
          ? ` — ${itemStatusLabel(translate, item.status)} · ${item.detail}`
          : ` — ${itemStatusLabel(translate, item.status)}`;
        copy.append(label, status);
        row.append(mark, copy);
        activities.append(row);
      });
      const live = this.ownerDocument.createElement("span");
      live.className = "live";
      live.setAttribute("part", "live");
      live.setAttribute("role", "status");
      live.setAttribute("aria-live", "polite");
      live.setAttribute("aria-atomic", "true");
      live.textContent = `${stage}. ${queueLabel}`;
      panel.append(header, queue, activities, live);
      root.replaceChildren(style, panel);
    }
  };
}

export function renderSpaceAgentQueueStatus(queue: SpaceAgentQueueView) {
  return `<${spaceAgentQueueStatusElementName} active-count="${Math.max(0, Math.floor(queue.activeCount))}" pending-count="${Math.max(0, Math.floor(queue.pendingCount))}"></${spaceAgentQueueStatusElementName}>`;
}

export function renderSpaceAgentActivity(activity: SpaceAgentActivityView) {
  const attributes = [
    `agent-id="${escapeSpaceAttribute(activity.agent.id)}"`,
    `name="${escapeSpaceAttribute(activity.agent.name)}"`,
    `status="${activity.agent.status}"`,
    `active-count="${activity.queue.activeCount}"`,
    `pending-count="${activity.queue.pendingCount}"`,
  ];
  if (activity.active) attributes.push("active");
  if (activity.stage) attributes.push(`stage="${escapeSpaceAttribute(activity.stage)}"`);
  return `<${spaceAgentActivityElementName} ${attributes.join(" ")}></${spaceAgentActivityElementName}>`;
}

export function defineSpaceAgentActivityElements(
  registry: SpaceElementRegistry | undefined = globalThis.customElements,
) {
  if (!registry || typeof globalThis.HTMLElement !== "function") return false;
  defineSpaceElement(
    registry,
    spaceAgentQueueStatusElementName,
    createSpaceAgentQueueStatusElementClass,
  );
  defineSpaceElement(
    registry,
    spaceAgentActivityElementName,
    createSpaceAgentActivityElementClass,
  );
  return true;
}
