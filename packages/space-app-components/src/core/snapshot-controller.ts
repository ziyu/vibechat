import type { SpaceAppSnapshot } from "@vibechat/space-app-sdk";
import type { SpaceComponentContext } from "./context.js";

export interface SpaceSnapshotController {
  readonly ready: Promise<void>;
  readonly disposed: boolean;
  getSnapshot(): SpaceAppSnapshot;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

export function createSpaceSnapshotController(
  context: SpaceComponentContext,
): SpaceSnapshotController {
  const listeners = new Set<() => void>();
  let snapshot = context.sdk.snapshot;
  let disposed = context.disposed;
  let unsubscribe = () => {};
  let removeFromContext = () => {};

  const publish = (value?: unknown) => {
    if (disposed) return;
    snapshot = value && typeof value === "object"
      ? value as SpaceAppSnapshot
      : context.sdk.snapshot;
    for (const listener of listeners) listener();
  };

  const controller: SpaceSnapshotController = {
    ready: disposed
      ? Promise.resolve()
      : context.sdk.ready.then(() => {
          publish(context.sdk.snapshot);
        }),
    get disposed() {
      return disposed;
    },
    getSnapshot() {
      return snapshot;
    },
    subscribe(listener) {
      if (typeof listener !== "function") {
        throw new TypeError("Space snapshot listener must be a function");
      }
      if (disposed) return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      removeFromContext();
      unsubscribe();
      listeners.clear();
    },
  };

  if (!disposed) {
    unsubscribe = context.sdk.on("snapshot", publish);
    removeFromContext = context.addDisposable(() => controller.dispose());
  }

  return controller;
}
