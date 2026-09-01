import { defineSpaceElements as defineSpaceAvatarElement } from "./avatar.js";
import { type SpaceElementRegistry } from "./element.js";
import { defineSpaceIconButtonElement } from "./icon-button.js";
import { defineSpaceStatusDotElement } from "./status-dot.js";

export function defineSpaceFoundationElements(
  registry: SpaceElementRegistry | undefined = globalThis.customElements,
) {
  if (!registry || typeof globalThis.HTMLElement !== "function") return false;
  defineSpaceAvatarElement(registry);
  defineSpaceIconButtonElement(registry);
  defineSpaceStatusDotElement(registry);
  return true;
}
