import { spaceUserInlineModule } from "@vibechat/space-app-components/user/inline";
import { renderModuleScript } from "../browser/module-script.js";
import {
  bootstrapCampfire,
  getCampfireElements,
  renderCampfire,
} from "./controller.js";

const componentSource = JSON.stringify(
  spaceUserInlineModule.source.replace(/<\/script/gi, "<\\/script"),
);

export const appClient = renderModuleScript({
  attributes: [
    `data-vibechat-user-components="${spaceUserInlineModule.packageVersion}"`,
    `data-vibechat-user-components-integrity="${spaceUserInlineModule.bundleHash}"`,
  ],
  imports: ['import { space } from "/v1/space-app-sdk";'],
  functions: [
    getCampfireElements,
    renderCampfire,
    bootstrapCampfire,
  ],
  bootstrap: `
const componentSource = ${componentSource};
const componentUrl = URL.createObjectURL(
  new Blob([componentSource], { type: "text/javascript" }),
);
try {
  const components = await import(componentUrl);
  await bootstrapCampfire(space, components);
} finally {
  URL.revokeObjectURL(componentUrl);
}
`,
});
