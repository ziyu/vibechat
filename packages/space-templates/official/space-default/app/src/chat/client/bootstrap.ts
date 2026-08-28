import type { SpaceSdk } from "../../browser/sdk.js";
import type { SpaceAgentActivityElement } from "@vibechat/space-app-components/agent";
import type { SpaceComponentContext } from "@vibechat/space-app-components/core";
import type {
  SpaceAgentActivityPanelRecipeHandle,
  SpaceAgentActivityPanelRecipeOptions,
  SpaceChatRecipeElements,
  SpaceChatRecipeHandle,
  SpaceChatRecipeOptions,
} from "@vibechat/space-app-components/recipes";
import type { ChatCopy } from "./copy.js";

interface SpaceRecipeModule {
  createSpaceComponentContext(options: { sdk: SpaceSdk }): SpaceComponentContext;
  resolveSpaceAgentActivityPanelElement(
    root: ParentNode,
    label?: string,
  ): SpaceAgentActivityElement;
  mountAgentActivityPanelRecipe(
    options: SpaceAgentActivityPanelRecipeOptions,
  ): SpaceAgentActivityPanelRecipeHandle;
  resolveSpaceChatRecipeElements(root: ParentNode, label?: string): SpaceChatRecipeElements;
  mountDefaultChatRecipe(options: SpaceChatRecipeOptions): SpaceChatRecipeHandle;
  mountChatDrawerRecipe(options: SpaceChatRecipeOptions): SpaceChatRecipeHandle;
}

export async function bootstrapChat(
  space: SpaceSdk,
  components: SpaceRecipeModule,
  mode: "full" | "dock",
  copy: () => ChatCopy,
) {
  const context = components.createSpaceComponentContext({ sdk: space });
  const options = {
    context,
    elements: components.resolveSpaceChatRecipeElements(
      document,
      "Default Chat App",
    ),
    copy,
  };
  const recipe = mode === "full"
    ? components.mountDefaultChatRecipe(options)
    : components.mountChatDrawerRecipe(options);
  const agentActivity = components.mountAgentActivityPanelRecipe({
    context,
    element: components.resolveSpaceAgentActivityPanelElement(
      document,
      "Default Chat Agent activity",
    ),
    maxActivities: 3,
  });
  window.addEventListener("pagehide", () => context.dispose(), { once: true });
  await Promise.all([recipe.ready, agentActivity.ready]);
}
