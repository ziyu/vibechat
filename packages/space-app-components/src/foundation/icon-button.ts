import { defineSpaceElement, type SpaceElementRegistry } from "./element.js";
import { escapeSpaceAttribute } from "./safety.js";

export const spaceIconButtonElementName = "vc-space-icon-button" as const;

export interface RenderSpaceIconButtonOptions {
  label: string;
  disabled?: boolean;
  loading?: boolean;
}

export const spaceIconButtonStyles = `
:host {
  display: inline-grid;
  inline-size: var(--vc-space-control-size, 2.75rem);
  block-size: var(--vc-space-control-size, 2.75rem);
  vertical-align: middle;
}

button {
  position: relative;
  display: grid;
  inline-size: 100%;
  block-size: 100%;
  min-inline-size: 44px;
  min-block-size: 44px;
  place-items: center;
  border: 1px solid var(--vc-space-color-border, #8a929a);
  border-radius: var(--vc-space-radius-control, .82rem);
  color: var(--vc-space-color-text, #172026);
  background: var(--vc-space-color-surface-raised, #fff);
  cursor: pointer;
  transition:
    transform var(--vc-space-motion-fast, 150ms) var(--vc-space-ease-out, cubic-bezier(.16, 1, .3, 1)),
    background-color var(--vc-space-motion-fast, 150ms) ease;
}

button:hover:not(:disabled) {
  transform: translateY(-1px);
  background: color-mix(in srgb, var(--vc-space-color-surface-raised, #fff) 88%, var(--vc-space-color-accent, #d95835));
}

button:focus-visible {
  outline: 3px solid var(--vc-space-color-focus, #1e6f5c);
  outline-offset: 3px;
}

button:active:not(:disabled) { transform: translateY(0) scale(.97); }
button:disabled { cursor: not-allowed; opacity: .52; }

.content {
  display: grid;
  inline-size: 1.2rem;
  block-size: 1.2rem;
  place-items: center;
}

.content ::slotted(svg) { inline-size: 100%; block-size: 100%; }

.spinner {
  display: none;
  inline-size: 1rem;
  block-size: 1rem;
  border: 2px solid color-mix(in srgb, currentColor 28%, transparent);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: vc-space-icon-spin .72s linear infinite;
}

:host([loading]) .content { display: none; }
:host([loading]) .spinner { display: block; }

@keyframes vc-space-icon-spin { to { transform: rotate(360deg); } }

@media (prefers-reduced-motion: reduce) {
  button { transition: none; }
  .spinner { animation-duration: 1.5s; }
}

@media (forced-colors: active), (prefers-contrast: more) {
  button { border: 2px solid ButtonText; box-shadow: none; }
  button:focus-visible { outline-color: Highlight; }
}
`;

export function renderSpaceIconButton(options: RenderSpaceIconButtonOptions) {
  const state = `${options.disabled ? " disabled" : ""}${options.loading ? " loading" : ""}`;
  return `<${spaceIconButtonElementName} label="${escapeSpaceAttribute(options.label)}"${state}></${spaceIconButtonElementName}>`;
}

function createSpaceIconButtonElementClass() {
  return class VcSpaceIconButtonElement extends HTMLElement {
    static readonly observedAttributes = ["disabled", "label", "loading"];

    connectedCallback() {
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      this.render();
    }

    attributeChangedCallback() {
      if (this.isConnected) this.render();
    }

    focus(options?: FocusOptions) {
      this.shadowRoot?.querySelector("button")?.focus(options);
    }

    click() {
      this.shadowRoot?.querySelector("button")?.click();
    }

    private render() {
      const root = this.shadowRoot;
      if (!root) return;
      const label = this.getAttribute("label")?.trim() || "Action";
      const loading = this.hasAttribute("loading");

      const style = this.ownerDocument.createElement("style");
      style.textContent = spaceIconButtonStyles;
      const button = this.ownerDocument.createElement("button");
      button.type = "button";
      button.disabled = this.hasAttribute("disabled") || loading;
      button.setAttribute("part", "button");
      button.setAttribute("aria-label", label);
      if (loading) button.setAttribute("aria-busy", "true");
      const content = this.ownerDocument.createElement("span");
      content.className = "content";
      content.setAttribute("part", "icon");
      content.append(this.ownerDocument.createElement("slot"));
      const spinner = this.ownerDocument.createElement("span");
      spinner.className = "spinner";
      spinner.setAttribute("part", "spinner");
      spinner.setAttribute("aria-hidden", "true");
      button.append(content, spinner);
      root.replaceChildren(style, button);
    }
  };
}

export function defineSpaceIconButtonElement(
  registry: SpaceElementRegistry | undefined = globalThis.customElements,
) {
  return defineSpaceElement(
    registry,
    spaceIconButtonElementName,
    createSpaceIconButtonElementClass,
  );
}
