import { defineSpaceAgentElements } from "./agent/elements.js";
import { defineSpaceChatElements } from "./chat/elements.js";
import { defineSpaceFoundationElements } from "./foundation/elements.js";
import type { SpaceElementRegistry } from "./foundation/element.js";
import { defineSpaceUserElements } from "./user/register.js";

export function defineSpaceElements(
  registry: SpaceElementRegistry | undefined = globalThis.customElements,
) {
  if (!registry || typeof globalThis.HTMLElement !== "function") return false;
  defineSpaceFoundationElements(registry);
  defineSpaceUserElements(registry);
  defineSpaceAgentElements(registry);
  defineSpaceChatElements(registry);
  return true;
}
