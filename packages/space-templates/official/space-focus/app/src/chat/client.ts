import { renderModuleScript } from "../browser/module-script.js";
import { spaceRecipesInlineModule } from "@vibechat/space-app-components/recipes/inline";
import { bootstrapChat } from "./client/bootstrap.js";
import { getChatCopy } from "./client/copy.js";

const componentSource = JSON.stringify(
  spaceRecipesInlineModule.source.replace(/<\/script/gi, "<\\/script"),
);

export const chatClient = renderModuleScript({
  attributes: [
    "data-vibechat-default-chat-app",
    `data-vibechat-components="${spaceRecipesInlineModule.packageVersion}"`,
    `data-vibechat-components-integrity="${spaceRecipesInlineModule.bundleHash}"`,
  ],
  imports: ['import { space } from "/v1/space-app-sdk";'],
  functions: [
    getChatCopy,
    bootstrapChat,
  ],
  bootstrap: `
const componentSource = ${componentSource};
const componentUrl = URL.createObjectURL(
  new Blob([componentSource], { type: "text/javascript" }),
);
try {
  const components = await import(componentUrl);
  await bootstrapChat(space, components, "dock", () => getChatCopy(space));
} finally {
  URL.revokeObjectURL(componentUrl);
}
`,
});
