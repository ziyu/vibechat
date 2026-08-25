import type { SpaceSdk } from "../../browser/sdk.js";

export interface ChatElements {
  root: HTMLElement;
  timeline: HTMLElement;
  form: HTMLFormElement;
  input: HTMLTextAreaElement;
  send: HTMLButtonElement;
  file: HTMLInputElement;
  attach: HTMLButtonElement;
  mentions: HTMLElement;
  context: HTMLElement;
  typing: HTMLElement;
  error: HTMLElement;
  launch: HTMLButtonElement;
  close: HTMLButtonElement;
  unread: HTMLElement;
  mark: HTMLElement;
  roomName: HTMLElement;
  memberCount: HTMLElement;
  hint: HTMLElement;
}

export function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Default Chat App is missing ${selector}`);
  return element;
}

export function getChatElements(): ChatElements {
  return {
    root: requireElement<HTMLElement>("#vcc-root"),
    timeline: requireElement<HTMLElement>("#vcc-timeline"),
    form: requireElement<HTMLFormElement>("#vcc-form"),
    input: requireElement<HTMLTextAreaElement>("#vcc-input"),
    send: requireElement<HTMLButtonElement>("#vcc-send"),
    file: requireElement<HTMLInputElement>("#vcc-file"),
    attach: requireElement<HTMLButtonElement>("#vcc-attach"),
    mentions: requireElement<HTMLElement>("#vcc-mentions"),
    context: requireElement<HTMLElement>("#vcc-context"),
    typing: requireElement<HTMLElement>("#vcc-typing"),
    error: requireElement<HTMLElement>("#vcc-error"),
    launch: requireElement<HTMLButtonElement>("#vcc-launch"),
    close: requireElement<HTMLButtonElement>("#vcc-close"),
    unread: requireElement<HTMLElement>("#vcc-unread"),
    mark: requireElement<HTMLElement>("#vcc-mark"),
    roomName: requireElement<HTMLElement>("#vcc-room-name"),
    memberCount: requireElement<HTMLElement>("#vcc-member-count"),
    hint: requireElement<HTMLElement>("#vcc-hint"),
  };
}

export function formatMessageTime(space: SpaceSdk, value: string | number) {
  try {
    return new Intl.DateTimeFormat(space.locale || "en", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

export function closestDataTarget(event: Event, selector: string) {
  return event.target instanceof Element
    ? event.target.closest<HTMLElement>(selector)
    : null;
}

export function resizeComposer(input: HTMLTextAreaElement) {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
}
