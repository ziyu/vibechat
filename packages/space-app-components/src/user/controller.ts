import type { SpaceComponentContext } from "../core/context.js";
import {
  createSpaceUserIdentityView,
  type SpaceUserIdentityView,
} from "./view.js";

export interface SpaceUserDirectorySnapshot {
  readonly self: SpaceUserIdentityView | null;
  readonly members: readonly SpaceUserIdentityView[];
}

export interface SpaceUserDirectoryController {
  readonly ready: Promise<void>;
  readonly disposed: boolean;
  getSnapshot(): SpaceUserDirectorySnapshot;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

function createSpaceUserDirectorySnapshot(
  context: SpaceComponentContext,
): SpaceUserDirectorySnapshot {
  return Object.freeze({
    self: context.sdk.snapshot.self
      ? createSpaceUserIdentityView(context.sdk.snapshot.self)
      : null,
    members: Object.freeze(
      context.sdk.snapshot.members.map(createSpaceUserIdentityView),
    ),
  });
}

function directorySignature(snapshot: SpaceUserDirectorySnapshot) {
  return JSON.stringify(snapshot);
}

export function createSpaceUserDirectoryController(
  context: SpaceComponentContext,
): SpaceUserDirectoryController {
  const listeners = new Set<() => void>();
  let snapshot = createSpaceUserDirectorySnapshot(context);
  let signature = directorySignature(snapshot);
  let disposed = context.disposed;
  let unsubscribe = () => {};
  let removeFromContext = () => {};

  const publish = () => {
    if (disposed) return;
    const next = createSpaceUserDirectorySnapshot(context);
    const nextSignature = directorySignature(next);
    if (nextSignature === signature) return;
    snapshot = next;
    signature = nextSignature;
    for (const listener of listeners) listener();
  };

  const controller: SpaceUserDirectoryController = {
    ready: disposed
      ? Promise.resolve()
      : context.sdk.ready.then(() => publish()),
    get disposed() {
      return disposed;
    },
    getSnapshot() {
      return snapshot;
    },
    subscribe(listener) {
      if (typeof listener !== "function") {
        throw new TypeError("Space User Directory listener must be a function");
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
    unsubscribe = context.listen("members", publish);
    removeFromContext = context.addDisposable(() => controller.dispose());
  }

  return controller;
}
