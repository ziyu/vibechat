import type { SpaceSdk } from "../browser/sdk.js";
import { escapeHtml } from "../browser/html.js";

interface CampfireElements {
  members: HTMLElement;
  copy: HTMLElement;
}

export function getCampfireElements(): CampfireElements {
  const members = document.querySelector<HTMLElement>("#members");
  const copy = document.querySelector<HTMLElement>("#copy");
  if (!members || !copy) throw new Error("Campfire App markup is incomplete");
  return { members, copy };
}

export function renderCampfire(space: SpaceSdk, elements: CampfireElements) {
  elements.copy.textContent = `${space.members.length} 位听众正在共享今晚的频率。Chat 始终在线，@Agent 可以继续改造这间电台。`;
  elements.members.innerHTML = space.members.length
    ? space.members
      .map((member) => `<span class="member">${escapeHtml(member.name || member.displayName)}</span>`)
      .join("")
    : '<span class="member">等待听众</span>';
}

export async function bootstrapCampfire(space: SpaceSdk) {
  space.theme.set({
    text: "#f8eee4",
    muted: "#c7b6aa",
    accent: "#ff6b42",
    surface: "#171b20",
    surfaceStrong: "#111419",
    border: "#61483e",
    own: "#ff9a78",
    peer: "#ffd0b5",
    agent: "#ff6b42",
    radius: "18px",
  });

  const elements = getCampfireElements();
  await space.ready;
  renderCampfire(space, elements);
  space.on("members", () => renderCampfire(space, elements));
  void space.updatePresence({ scene: "radio", status: "listening" });
}
