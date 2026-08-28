import type { SpaceElementRegistry } from "../foundation/element.js";
import { defineSpaceUserDirectoryElements } from "./directory-elements.js";
import { defineSpaceMentionTargetItemElement } from "./mention-elements.js";

export function defineSpaceUserElements(
  registry: SpaceElementRegistry | undefined = globalThis.customElements,
) {
  if (!registry || typeof globalThis.HTMLElement !== "function") return false;
  defineSpaceUserDirectoryElements(registry);
  defineSpaceMentionTargetItemElement(registry);
  return true;
}
