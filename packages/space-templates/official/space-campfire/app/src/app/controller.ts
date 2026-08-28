import type { SpaceSdk } from "../browser/sdk.js";

interface CampfireMemberView {
  readonly id: string;
  readonly name: string;
  readonly handle: string | null;
  readonly avatarUrl: string | null;
  readonly presence: "online" | "away" | "offline";
}

interface CampfireDirectorySnapshot {
  readonly members: readonly CampfireMemberView[];
}

interface CampfireComponentContext {
  dispose(): void;
}

interface CampfireDirectoryController {
  readonly ready: Promise<void>;
  getSnapshot(): CampfireDirectorySnapshot;
  subscribe(listener: () => void): () => void;
}

interface CampfireUserComponents {
  createSpaceComponentContext(options: {
    sdk: unknown;
    locale?: string;
  }): CampfireComponentContext;
  createSpaceUserDirectoryController(
    context: CampfireComponentContext,
  ): CampfireDirectoryController;
}

interface CampfireMemberListElement extends HTMLElement {
  users: readonly CampfireMemberView[];
}

interface CampfireElements {
  members: CampfireMemberListElement;
  copy: HTMLElement;
}

export function getCampfireElements(): CampfireElements {
  const members = document.querySelector<CampfireMemberListElement>("#members");
  const copy = document.querySelector<HTMLElement>("#copy");
  if (!members || !copy) throw new Error("Campfire App markup is incomplete");
  return { members, copy };
}

export function renderCampfire(
  snapshot: CampfireDirectorySnapshot,
  elements: CampfireElements,
) {
  elements.copy.textContent = `${snapshot.members.length} 位听众正在共享今晚的频率。Chat 始终在线，@Agent 可以继续改造这间电台。`;
  elements.members.users = snapshot.members;
}

export async function bootstrapCampfire(
  space: SpaceSdk,
  components: CampfireUserComponents,
) {
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
  const context = components.createSpaceComponentContext({
    sdk: space,
    locale: space.locale,
  });
  const directory = components.createSpaceUserDirectoryController(context);
  const render = () => renderCampfire(directory.getSnapshot(), elements);
  const unsubscribe = directory.subscribe(render);
  await directory.ready;
  render();
  window.addEventListener("pagehide", () => {
    unsubscribe();
    context.dispose();
  }, { once: true });
  void space.updatePresence({ scene: "radio", status: "listening" });
}
