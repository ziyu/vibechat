import {
  createSpaceAgentController,
  type CreateSpaceAgentActivityViewOptions,
  type SpaceAgentController,
} from "../agent/activity.js";
import {
  spaceAgentActivityElementName,
  type SpaceAgentActivityElement,
} from "../agent/activity-elements.js";
import type { SpaceComponentContext } from "../core/context.js";

export interface SpaceAgentActivityPanelRecipeOptions
  extends CreateSpaceAgentActivityViewOptions {
  readonly context: SpaceComponentContext;
  readonly element: SpaceAgentActivityElement;
  /** Keeps the panel mounted while idle. Defaults to activity-only visibility. */
  readonly showWhenIdle?: boolean;
}

export interface SpaceAgentActivityPanelRecipeHandle {
  readonly ready: Promise<void>;
  readonly controller: SpaceAgentController;
  readonly disposed: boolean;
  dispose(): void;
}

export function resolveSpaceAgentActivityPanelElement(
  root: ParentNode,
  label = "Space Agent activity panel recipe",
) {
  const element = root.querySelector<SpaceAgentActivityElement>(
    spaceAgentActivityElementName,
  );
  if (!element) {
    throw new Error(`${label} is missing ${spaceAgentActivityElementName}`);
  }
  return element;
}

export function mountAgentActivityPanelRecipe(
  options: SpaceAgentActivityPanelRecipeOptions,
): SpaceAgentActivityPanelRecipeHandle {
  const { context, element } = options;
  if (context.disposed) {
    throw new Error("Space Agent activity recipe requires an active component context");
  }
  if (!element || typeof element.setAttribute !== "function") {
    throw new TypeError("Space Agent activity recipe requires an activity element");
  }

  const controller = createSpaceAgentController(context, {
    maxActivities: options.maxActivities,
  });
  let disposed = false;
  let removeFromContext = () => {};

  const render = () => {
    if (disposed) return;
    const activity = controller.getSnapshot();
    const visible = options.showWhenIdle === true
      || activity.active
      || activity.queue.activeCount > 0
      || activity.queue.pendingCount > 0;
    element.setAttribute(
      "locale",
      context.sdk.locale || context.sdk.snapshot.locale || context.locale,
    );
    element.hidden = !visible;
    element.style.display = visible ? "" : "none";
    if (visible) {
      element.removeAttribute("aria-hidden");
    } else {
      element.setAttribute("aria-hidden", "true");
    }
    element.activity = activity;
  };
  const unsubscribe = controller.subscribe(render);

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    removeFromContext();
    unsubscribe();
    controller.dispose();
  };
  removeFromContext = context.addDisposable(dispose);
  render();

  return {
    ready: controller.ready.then(() => render()),
    controller,
    get disposed() {
      return disposed;
    },
    dispose,
  };
}
