import { appClient } from "./app/client.js";
import { appMarkup } from "./app/markup.js";
import { appStyles } from "./app/styles.js";
import { chatClient } from "./chat/client.js";
import { chatMarkup } from "./chat/markup.js";
import { chatStyles } from "./chat/styles.js";

const documentHead = "<!doctype html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>像素星期六</title>";
const bodyOpen = "</head><body>";
const documentClose = "</body></html>";

export function renderDocument() {
  return [
    documentHead,
    appStyles,
    chatStyles,
    bodyOpen,
    appMarkup,
    appClient,
    chatMarkup,
    chatClient,
    documentClose,
  ].join("");
}
