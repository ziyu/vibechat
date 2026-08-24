import { escapeHtml } from "../browser/html.js";
import type { SpaceSdk } from "../browser/sdk.js";

interface FocusNote {
  text: string;
  author: string;
  at: number;
}

interface FocusElements {
  board: HTMLElement;
  presence: HTMLElement;
  form: HTMLFormElement;
  input: HTMLInputElement;
}

export function getFocusElements(): FocusElements {
  const board = document.querySelector<HTMLElement>("#board");
  const presence = document.querySelector<HTMLElement>("#presence");
  const form = document.querySelector<HTMLFormElement>("#form");
  const input = document.querySelector<HTMLInputElement>("#note");
  if (!board || !presence || !form || !input) {
    throw new Error("Focus App markup is incomplete");
  }
  return { board, presence, form, input };
}

export function getFocusNotes(space: SpaceSdk): FocusNote[] {
  const value = space.state.get<unknown>("studio.notes");
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is FocusNote => {
    if (!item || typeof item !== "object") return false;
    const record = item as Record<string, unknown>;
    return typeof record.text === "string" && typeof record.author === "string";
  });
}

export function renderFocus(space: SpaceSdk, elements: FocusElements) {
  const notes = getFocusNotes(space);
  elements.board.innerHTML = notes.length ? notes.map((note, index) => `
    <article class="note" style="--r:${index % 2 ? 1.2 : -1.1}deg">
      ${escapeHtml(note.text)}<br>
      <small>— ${escapeHtml(note.author)}</small>
    </article>
  `).join("") : `
    <article class="note" style="--r:-1deg">
      第一张便签还空着。<br>
      <small>这个 Space 已经准备好。</small>
    </article>
  `;
  elements.presence.textContent = `${space.members.length} 位成员同桌`;
}

export async function bootstrapFocus(space: SpaceSdk) {
  space.theme.set({
    text: "#eef5df",
    muted: "#aab9a5",
    accent: "#b7d66d",
    surface: "#23342b",
    surfaceStrong: "#19271f",
    border: "#6e865b",
    own: "#d9ef9e",
    peer: "#93c4a7",
    agent: "#b7d66d",
    radius: "12px",
  });

  const elements = getFocusElements();
  await space.ready;
  renderFocus(space, elements);
  space.state.on("studio.notes", () => renderFocus(space, elements));
  space.on("members", () => renderFocus(space, elements));
  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = elements.input.value.trim();
    if (!text) return;
    const next = [
      ...getFocusNotes(space),
      { text, author: space.self?.name || "成员", at: Date.now() },
    ].slice(-12);
    void space.state.set("studio.notes", next);
    elements.input.value = "";
  });
  void space.updatePresence({ scene: "studio", status: "writing" });
}
