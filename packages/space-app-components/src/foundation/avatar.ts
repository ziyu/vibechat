import { spaceAvatarStyles } from "./styles.js";
import { defineSpaceElement, type SpaceElementRegistry } from "./element.js";
import {
  escapeSpaceAttribute,
  sanitizeSpaceMediaUrl,
} from "./safety.js";

export const spaceAvatarElementName = "vc-space-avatar" as const;
export type SpaceAvatarSize = "sm" | "md" | "lg";
export type SpaceAvatarStatus = "online" | "away" | "offline" | "none";

export interface RenderSpaceAvatarOptions {
  name: string;
  src?: string | null;
  label?: string;
  size?: SpaceAvatarSize;
  status?: SpaceAvatarStatus;
}

export function spaceAvatarInitials(name: string) {
  const normalized = name.trim();
  if (!normalized) return "?";
  const words = normalized.split(/\s+/u);
  const glyphs = words.length > 1
    ? words.slice(0, 2).map((word) => Array.from(word)[0])
    : Array.from(normalized).slice(0, 2);
  return glyphs.join("").toLocaleUpperCase();
}

export function renderSpaceAvatar(options: RenderSpaceAvatarOptions) {
  const name = options.name.trim() || "Member";
  const attributes = [
    `name="${escapeSpaceAttribute(name)}"`,
    `size="${options.size ?? "md"}"`,
    `status="${options.status ?? "none"}"`,
  ];
  const source = sanitizeSpaceMediaUrl(options.src);
  if (source) attributes.push(`src="${escapeSpaceAttribute(source)}"`);
  if (options.label) {
    attributes.push(`label="${escapeSpaceAttribute(options.label)}"`);
  }
  return `<${spaceAvatarElementName} ${attributes.join(" ")}></${spaceAvatarElementName}>`;
}

function createSpaceAvatarElementClass() {
  return class VcSpaceAvatarElement extends HTMLElement {
    static readonly observedAttributes = [
      "label",
      "name",
      "size",
      "src",
      "status",
    ];

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
      const document = this.ownerDocument;
      const name = this.getAttribute("name")?.trim() || "Member";
      const label = this.getAttribute("label")?.trim() || `${name} avatar`;
      const status = this.getAttribute("status") ?? "none";
      const source = sanitizeSpaceMediaUrl(this.getAttribute("src"));

      this.setAttribute("role", "img");
      this.setAttribute("aria-label", label);

      const style = document.createElement("style");
      style.textContent = spaceAvatarStyles;
      const frame = document.createElement("span");
      frame.className = "frame";
      frame.setAttribute("part", "frame");

      const initials = document.createElement("span");
      initials.className = "initials";
      initials.setAttribute("part", "initials");
      initials.textContent = spaceAvatarInitials(name);
      frame.append(initials);

      if (source) {
        const image = document.createElement("img");
        image.alt = "";
        image.src = source;
        image.setAttribute("part", "image");
        image.addEventListener("error", () => image.remove(), { once: true });
        frame.append(image);
      }

      const statusDot = document.createElement("span");
      statusDot.className = "status";
      statusDot.dataset.status = status;
      statusDot.setAttribute("part", "status");
      statusDot.hidden = !["online", "away", "offline"].includes(status);
      frame.append(statusDot);

      root.replaceChildren(style, frame);
    }
  };
}

export function defineSpaceElements(
  registry: SpaceElementRegistry | undefined = globalThis.customElements,
) {
  return defineSpaceElement(
    registry,
    spaceAvatarElementName,
    createSpaceAvatarElementClass,
  );
}

export { sanitizeSpaceMediaUrl } from "./safety.js";
