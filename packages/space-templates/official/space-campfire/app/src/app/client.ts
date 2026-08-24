import { escapeHtml } from "../browser/html.js";
import { renderModuleScript } from "../browser/module-script.js";
import {
  bootstrapCampfire,
  getCampfireElements,
  renderCampfire,
} from "./controller.js";

export const appClient = renderModuleScript({
  imports: ['import { space } from "/v1/space-app-sdk";'],
  functions: [
    escapeHtml,
    getCampfireElements,
    renderCampfire,
    bootstrapCampfire,
  ],
  bootstrap: "await bootstrapCampfire(space);",
});
