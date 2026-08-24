import type { SpaceSdk } from "../browser/sdk.js";

interface ArcadeElements {
  pixel: HTMLElement;
  players: HTMLElement;
  copy: HTMLElement;
  collect: HTMLButtonElement;
  signal: HTMLButtonElement;
}

export function getArcadeElements(): ArcadeElements {
  const pixel = document.querySelector<HTMLElement>("#pixel");
  const players = document.querySelector<HTMLElement>("#players");
  const copy = document.querySelector<HTMLElement>("#copy");
  const collect = document.querySelector<HTMLButtonElement>("#collect");
  const signal = document.querySelector<HTMLButtonElement>("#signal");
  if (!pixel || !players || !copy || !collect || !signal) {
    throw new Error("Arcade App markup is incomplete");
  }
  return { pixel, players, copy, collect, signal };
}

export function getBadgeCount(space: SpaceSdk) {
  return Number(space.state.get("arcade.badges")) || 0;
}

export function renderArcade(space: SpaceSdk, elements: ArcadeElements) {
  const count = getBadgeCount(space);
  elements.pixel.textContent = ["✦", "◆", "★", "✸"][count % 4] || "✦";
  elements.copy.textContent = `这个 Space 已共同收集 ${count} 枚徽章。`;
  elements.players.textContent = `PLAYERS ${space.members.length}`;
}

export async function bootstrapArcade(space: SpaceSdk) {
  space.theme.set({
    text: "#fff5bf",
    muted: "#d6ca95",
    accent: "#ffd84d",
    surface: "#34274f",
    surfaceStrong: "#211832",
    border: "#ffd84d",
    own: "#ff7791",
    peer: "#82d9bf",
    agent: "#ffd84d",
    radius: "8px",
  });

  const elements = getArcadeElements();
  await space.ready;
  renderArcade(space, elements);
  space.state.on("arcade.badges", () => renderArcade(space, elements));
  space.on("members", () => renderArcade(space, elements));
  elements.collect.addEventListener("click", () => {
    void space.state.set("arcade.badges", getBadgeCount(space) + 1);
  });
  elements.signal.addEventListener("click", () => {
    void space.emit("arcade.signal", { from: space.self?.name });
  });
  space.onEvent("arcade.signal", () => {
    elements.pixel.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.35)" }, { transform: "scale(1)" }],
      { duration: 420 },
    );
  });
  void space.updatePresence({ scene: "arcade", status: "playing" });
}
