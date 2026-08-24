import { appClient } from "./app/client.js";
import { appMarkup } from "./app/markup.js";
import { appStyles } from "./app/styles.js";

export function renderDocument() {
  return `<!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Untitled space</title>
        ${appStyles}
      </head>
      <body>
        ${appMarkup}
        ${appClient}
      </body>
    </html>`;
}
