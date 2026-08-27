import type { SpaceSdk } from "../../browser/sdk.js";
import type { SpaceComponentContext } from "@vibechat/space-app-components/core";
import type {
  SpaceChatRecipeElements,
  SpaceChatRecipeHandle,
  SpaceChatRecipeOptions,
} from "@vibechat/space-app-components/recipes";
import { getChatCopy } from "./copy.js";

interface SpaceChatRecipeModule {
  createSpaceComponentContext(options: { sdk: SpaceSdk }): SpaceComponentContext;
  resolveSpaceChatRecipeElements(root: ParentNode, label?: string): SpaceChatRecipeElements;
  mountDefaultChatRecipe(options: SpaceChatRecipeOptions): SpaceChatRecipeHandle;
  mountChatDrawerRecipe(options: SpaceChatRecipeOptions): SpaceChatRecipeHandle;
}

export async function bootstrapChat(
  space: SpaceSdk,
  components: SpaceChatRecipeModule,
  mode: "full" | "dock",
) {
  const context = components.createSpaceComponentContext({ sdk: space });
  const options = {
    context,
    elements: components.resolveSpaceChatRecipeElements(
      document,
      "Default Chat App",
    ),
    copy: () => getChatCopy(space),
  };
  const recipe = mode === "full"
    ? components.mountDefaultChatRecipe(options)
    : components.mountChatDrawerRecipe(options);
  window.addEventListener("pagehide", () => context.dispose(), { once: true });
  await recipe.ready;
}
