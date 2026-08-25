import { escapeHtml } from "../browser/html.js";
import { renderModuleScript } from "../browser/module-script.js";
import {
  bootstrapPostcard,
  getPostcardElements,
  getPostcards,
  renderPostcards,
} from "./controller.js";

export const appClient = renderModuleScript({
  imports: ['import { space } from "/v1/space-app-sdk";'],
  functions: [
    escapeHtml,
    getPostcardElements,
    getPostcards,
    renderPostcards,
    bootstrapPostcard,
  ],
  bootstrap: "await bootstrapPostcard(space);",
});
