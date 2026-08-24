import { escapeHtml } from "../browser/html.js";
import { renderModuleScript } from "../browser/module-script.js";
import {
  bootstrapFocus,
  getFocusElements,
  getFocusNotes,
  renderFocus,
} from "./controller.js";

export const appClient = renderModuleScript({
  imports: ['import { space } from "/v1/space-app-sdk";'],
  functions: [
    escapeHtml,
    getFocusElements,
    getFocusNotes,
    renderFocus,
    bootstrapFocus,
  ],
  bootstrap: "await bootstrapFocus(space);",
});
