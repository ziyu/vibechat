import { renderModuleScript } from "../browser/module-script.js";
import {
  bootstrapArcade,
  getArcadeElements,
  getBadgeCount,
  renderArcade,
} from "./controller.js";

export const appClient = renderModuleScript({
  imports: ['import { space } from "/v1/space-app-sdk";'],
  functions: [
    getArcadeElements,
    getBadgeCount,
    renderArcade,
    bootstrapArcade,
  ],
  bootstrap: "await bootstrapArcade(space);",
});
