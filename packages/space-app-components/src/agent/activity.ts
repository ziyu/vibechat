import type { SpaceAppSnapshot } from "@vibechat/space-app-sdk";

import type { SpaceComponentContext } from "../core/context.js";
import { createSpaceAgentIdentityView, type SpaceAgentIdentityView } from "./view.js";

export type SpaceAgentActivityItemStatus =
  | "queued"
  | "active"
  | "completed"
  | "failed"
  | "unknown";

export interface SpaceAgentQueueView {
  readonly activeCount: number;
  readonly pendingCount: number;
}

export interface SpaceAgentActivityItemView {
  readonly id: string;
  readonly label: string | null;
  readonly detail: string | null;
  readonly status: SpaceAgentActivityItemStatus;
}

export interface SpaceAgentActivityView {
  readonly agent: SpaceAgentIdentityView;
  readonly active: boolean;
  readonly stage: string | null;
  readonly queue: SpaceAgentQueueView;
  readonly activities: readonly SpaceAgentActivityItemView[];
}

export interface CreateSpaceAgentActivityViewOptions {
  /** Limits noisy provider activity without exposing provider payloads. */
  readonly maxActivities?: number;
}

export interface SpaceAgentController {
  readonly ready: Promise<void>;
  readonly disposed: boolean;
  getSnapshot(): SpaceAgentActivityView;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

const defaultMaxActivities = 5;
const maximumActivityLimit = 12;
const maximumLabelLength = 160;
const maximumDetailLength = 280;

function finiteCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

function boundedText(value: unknown, maximumLength: number) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return Array.from(normalized).slice(0, maximumLength).join("");
}

function firstText(
  source: Readonly<Record<string, unknown>>,
  keys: readonly string[],
  maximumLength: number,
) {
  for (const key of keys) {
    const value = boundedText(source[key], maximumLength);
    if (value) return value;
  }
  return null;
}

function normalizeActivityStatus(value: unknown): SpaceAgentActivityItemStatus {
  const status = boundedText(value, 32)?.toLowerCase();
  if (["queued", "pending", "waiting"].includes(status ?? "")) return "queued";
  if (["active", "running", "working", "started", "in_progress"].includes(status ?? "")) {
    return "active";
  }
  if (["complete", "completed", "done", "success", "succeeded"].includes(status ?? "")) {
    return "completed";
  }
  if (["error", "failed", "failure"].includes(status ?? "")) return "failed";
  return "unknown";
}

function normalizeActivityLimit(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return defaultMaxActivities;
  return Math.min(maximumActivityLimit, Math.max(0, Math.floor(value)));
}

function createActivityItems(
  build: Readonly<Record<string, unknown>> | null,
  maximum: number,
) {
  if (!build || !Array.isArray(build.activities) || maximum === 0) {
    return Object.freeze([]) as readonly SpaceAgentActivityItemView[];
  }
  return Object.freeze(build.activities
    .filter((item): item is Readonly<Record<string, unknown>> =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .slice(-maximum)
    .map((item, index) => Object.freeze({
      id: firstText(item, ["id", "activityId"], maximumLabelLength)
        ?? `activity-${index + 1}`,
      label: firstText(
        item,
        ["label", "title", "name", "tool", "stage"],
        maximumLabelLength,
      ),
      detail: firstText(item, ["summary", "detail"], maximumDetailLength),
      status: normalizeActivityStatus(item.status ?? item.state),
    })));
}

export function createSpaceAgentActivityView(
  agent: SpaceAppSnapshot["agent"],
  options: CreateSpaceAgentActivityViewOptions = {},
): SpaceAgentActivityView {
  const build = agent.build
      && typeof agent.build === "object"
      && !Array.isArray(agent.build)
    ? agent.build
    : null;
  const identity = createSpaceAgentIdentityView(agent);
  const queue = Object.freeze({
    activeCount: finiteCount(agent.queue?.activeCount),
    pendingCount: finiteCount(agent.queue?.pendingCount),
  });
  return Object.freeze({
    agent: identity,
    active: build !== null && identity.status === "working",
    stage: build
      ? firstText(build, ["stage"], maximumLabelLength)
      : null,
    queue,
    activities: createActivityItems(build, normalizeActivityLimit(options.maxActivities)),
  });
}

function activitySignature(view: SpaceAgentActivityView) {
  return JSON.stringify(view);
}

export function createSpaceAgentController(
  context: SpaceComponentContext,
  options: CreateSpaceAgentActivityViewOptions = {},
): SpaceAgentController {
  const listeners = new Set<() => void>();
  let snapshot = createSpaceAgentActivityView(context.sdk.snapshot.agent, options);
  let signature = activitySignature(snapshot);
  let disposed = context.disposed;
  let unsubscribe = () => {};
  let removeFromContext = () => {};

  const publish = () => {
    if (disposed) return;
    const next = createSpaceAgentActivityView(context.sdk.snapshot.agent, options);
    const nextSignature = activitySignature(next);
    if (nextSignature === signature) return;
    snapshot = next;
    signature = nextSignature;
    for (const listener of listeners) listener();
  };

  const controller: SpaceAgentController = {
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
        throw new TypeError("Space Agent listener must be a function");
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
    unsubscribe = context.listen("agent", publish);
    removeFromContext = context.addDisposable(() => controller.dispose());
  }

  return controller;
}
