import { escapeHtml } from "../browser/html.js";
import type { SpaceSdk } from "../browser/sdk.js";

interface Postcard {
  text: string;
  author: string;
  at: number;
}

interface PostcardElements {
  cards: HTMLElement;
  count: HTMLElement;
  form: HTMLFormElement;
  message: HTMLTextAreaElement;
}

export function getPostcardElements(): PostcardElements {
  const cards = document.querySelector<HTMLElement>("#postcards");
  const count = document.querySelector<HTMLElement>("#count");
  const form = document.querySelector<HTMLFormElement>("#form");
  const message = document.querySelector<HTMLTextAreaElement>("#message");
  if (!cards || !count || !form || !message) {
    throw new Error("Postcard App markup is incomplete");
  }
  return { cards, count, form, message };
}

export function getPostcards(space: SpaceSdk): Postcard[] {
  const value = space.state.get<unknown>("postcard.messages");
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Postcard => {
    if (!item || typeof item !== "object") return false;
    const record = item as Record<string, unknown>;
    return typeof record.text === "string" && typeof record.author === "string";
  });
}

export function renderPostcards(space: SpaceSdk, elements: PostcardElements) {
  const postcards = getPostcards(space);
  elements.count.textContent = `${postcards.length} POSTCARDS`;
  elements.cards.innerHTML = postcards.length ? postcards.map((item, index) => `
    <article class="card">
      <span class="stamp">TOMORROW ${String(index + 1).padStart(2, "0")}</span>
      <p>${escapeHtml(item.text)}</p>
      <small>FROM ${escapeHtml(item.author)}</small>
    </article>
  `).join("") : `
    <article class="card">
      <span class="stamp">READY</span>
      <p>这里还没有信，但这个 Space 已经准备好。</p>
      <small>FROM VIBECHAT</small>
    </article>
  `;
}

export async function bootstrapPostcard(space: SpaceSdk) {
  space.theme.set({
    text: "#352923",
    muted: "#826d61",
    accent: "#d84b42",
    surface: "#efe5d2",
    surfaceStrong: "#faf2e3",
    border: "#b69275",
    own: "#d84b42",
    peer: "#567e78",
    agent: "#b99732",
    radius: "4px",
  });

  const elements = getPostcardElements();
  await space.ready;
  renderPostcards(space, elements);
  space.state.on("postcard.messages", () => renderPostcards(space, elements));
  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = elements.message.value.trim();
    if (!text) return;
    const next = [
      ...getPostcards(space),
      { text, author: space.self?.name || "成员", at: Date.now() },
    ].slice(-10);
    void space.state.set("postcard.messages", next);
    elements.message.value = "";
  });
  void space.updatePresence({ scene: "postcard", status: "writing" });
}
