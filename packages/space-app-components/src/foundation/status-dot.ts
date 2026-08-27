import { defineSpaceElement, type SpaceElementRegistry } from "./element.js";
import { escapeSpaceAttribute } from "./safety.js";

export const spaceStatusDotElementName = "vc-space-status-dot" as const;

export type SpaceIdentityStatus =
  | "online"
  | "away"
  | "offline"
  | "idle"
  | "queued"
  | "working"
  | "unavailable"
  | "failed";

export interface RenderSpaceStatusDotOptions {
  status: SpaceIdentityStatus;
  label: string;
  showLabel?: boolean;
}

export const spaceStatusDotStyles = `
:host {
  display: inline-flex;
  min-inline-size: 0;
  align-items: center;
  gap: var(--vc-space-gap-xs, .42rem);
  color: var(--vc-space-color-text-muted, #5d6670);
  font: 650 var(--vc-space-text-caption-size, .75rem) / 1.25 var(--vc-space-font-body, sans-serif);
}

.dot {
  position: relative;
  flex: 0 0 auto;
  inline-size: var(--vc-space-status-size, .68rem);
  block-size: var(--vc-space-status-size, .68rem);
  border: 1px solid color-mix(in srgb, currentColor 24%, transparent);
  border-radius: 50%;
  background: var(--vc-space-status-color, var(--vc-space-color-neutral, #8b929c));
}

:host([status="online"]) { --vc-space-status-color: var(--vc-space-color-positive, #438a5e); }
:host([status="away"]),
:host([status="queued"]) { --vc-space-status-color: var(--vc-space-color-warning, #a86a16); }
:host([status="offline"]),
:host([status="idle"]) { --vc-space-status-color: var(--vc-space-color-neutral, #77808a); }
:host([status="working"]) { --vc-space-status-color: var(--vc-space-color-accent, #d95835); }
:host([status="unavailable"]),
:host([status="failed"]) { --vc-space-status-color: var(--vc-space-color-negative, #b13f4b); }

:host([status="working"]) .dot::after {
  content: "";
  position: absolute;
  inset: -4px;
  border: 1px solid var(--vc-space-status-color);
  border-radius: inherit;
  opacity: .34;
  animation: vc-space-status-pulse 1.8s var(--vc-space-ease-out, cubic-bezier(.16, 1, .3, 1)) infinite;
}

.label {
  min-inline-size: 0;
  overflow-wrap: anywhere;
}

:host(:not([show-label])) .label {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

@keyframes vc-space-status-pulse {
  from { transform: scale(.7); opacity: .48; }
  to { transform: scale(1.55); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  :host([status="working"]) .dot::after { animation: none; opacity: .55; }
}

@media (forced-colors: active), (prefers-contrast: more) {
  .dot { border: 2px solid currentColor; background: Canvas; }
  :host([status="working"]) .dot::after { border-width: 2px; }
}
`;

export function renderSpaceStatusDot(options: RenderSpaceStatusDotOptions) {
  return `<${spaceStatusDotElementName} status="${options.status}" label="${escapeSpaceAttribute(options.label)}"${options.showLabel ? " show-label" : ""}></${spaceStatusDotElementName}>`;
}

function createSpaceStatusDotElementClass() {
  return class VcSpaceStatusDotElement extends HTMLElement {
    static readonly observedAttributes = ["label", "show-label", "status"];

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
      const status = this.getAttribute("status") || "offline";
      const label = this.getAttribute("label")?.trim() || status;
      this.setAttribute("role", "img");
      this.setAttribute("aria-label", label);

      const style = this.ownerDocument.createElement("style");
      style.textContent = spaceStatusDotStyles;
      const dot = this.ownerDocument.createElement("span");
      dot.className = "dot";
      dot.setAttribute("part", "dot");
      dot.setAttribute("aria-hidden", "true");
      const text = this.ownerDocument.createElement("span");
      text.className = "label";
      text.setAttribute("part", "label");
      text.textContent = label;
      root.replaceChildren(style, dot, text);
    }
  };
}

export function defineSpaceStatusDotElement(
  registry: SpaceElementRegistry | undefined = globalThis.customElements,
) {
  return defineSpaceElement(
    registry,
    spaceStatusDotElementName,
    createSpaceStatusDotElementClass,
  );
}
