import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { GenerationProgress } from "./generator.js";
import { assertAppId, type ProjectFiles } from "./project-store.js";

export type SpaceMessageType = "user" | "agent" | "error";

export interface SpaceMessage {
  id: string;
  turnId: string;
  type: SpaceMessageType;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
  externalRequestId?: string;
}

export interface SpaceMember {
  clientId: string;
  name: string;
}

export type SpaceAppValue =
  | null
  | boolean
  | number
  | string
  | SpaceAppValue[]
  | { [key: string]: SpaceAppValue };

export interface SpaceAppPresence {
  clientId: string;
  name: string;
  value: Record<string, SpaceAppValue>;
  updatedAt: string;
}

interface SpaceAppState {
  revision: number;
  values: Record<string, SpaceAppValue>;
}

export interface ActiveSpaceBuild {
  turnId: string;
  authorName: string;
  requestCount: number;
  startedAt: string;
  stage: string;
  agentText: string;
  activities: Array<Record<string, unknown>>;
  draftFiles?: ProjectFiles;
  agentId: string;
}

export type SpaceBuildProgress =
  | GenerationProgress
  | {
      type: "status";
      stage: string;
      message: string;
      attempt?: number;
    };

export type SpaceEvent = Record<string, unknown> & { type: string };
type EventSender = (event: SpaceEvent) => Promise<void>;

interface SpaceConnection {
  id: string;
  member: SpaceMember;
  send: EventSender;
}

interface LocalSpace {
  appId: string;
  messages: SpaceMessage[];
  appState: SpaceAppState;
  appPresence: Map<string, SpaceAppPresence>;
  queuedTurns: SpaceTurnRequest[];
  activeTurns: SpaceTurnRequest[];
  connections: Map<string, SpaceConnection>;
  sequence: number;
  build: ActiveSpaceBuild | null;
  ready: Promise<void>;
  saveQueue: Promise<void>;
}

interface BeginTurnInput {
  clientId: string;
  authorName: string;
  text: string;
  kind?: SpaceTurnKind;
  externalRequestId: string;
  agentId: string;
  billing?: SpaceTurnBilling;
  recovery?: SpaceTurnRecovery;
}

export type SpaceTurnKind = "message" | "publish" | "restore";

export interface SpaceTurnRecovery {
  target: "default-chat";
  expectedReadyRevisionId: string;
}

export interface SpaceTurnRequest {
  turnId: string;
  kind: SpaceTurnKind;
  clientId: string;
  authorName: string;
  text: string;
  createdAt: string;
  externalRequestId: string;
  agentId: string;
  billing?: SpaceTurnBilling;
  recovery?: SpaceTurnRecovery;
}

export interface SpaceTurnBilling {
  callbackUrl: string;
  userId: string;
  requestId: string;
  provider: string;
  model: string;
  reservedCredits: number;
  transactionId: string;
}

export interface ClaimedSpaceTurn {
  turnId: string;
  kind: SpaceTurnKind;
  requests: SpaceTurnRequest[];
}

export interface SpaceQueueState {
  activeCount: number;
  pendingCount: number;
}

const spaceDirectory = resolve(
  process.env.SPACE_RUNTIME_DATA_DIR ?? join(process.cwd(), ".data", "spaces"),
);
const maximumStoredMessages = 100;
const maximumAppPresenceBytes = 8 * 1024;
const maximumAppEventBytes = 16 * 1024;
const maximumAppStateBytes = 128 * 1024;
const maximumAppStateKeys = 128;
const maximumAppValueDepth = 12;
const safeAppKeyPattern = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,63}$/;
const unsafeObjectKeys = new Set(["__proto__", "constructor", "prototype"]);

export class SpaceInstanceServer {
  readonly #spaces = new Map<string, LocalSpace>();
  readonly #onTurnAvailable?: (appId: string) => void;

  constructor(onTurnAvailable?: (appId: string) => void) {
    this.#onTurnAvailable = onTurnAvailable;
  }

  async subscribe(appId: string, member: SpaceMember, send: EventSender) {
    const space = await this.#getReadySpace(appId);
    const connection: SpaceConnection = {
      id: randomUUID(),
      member,
      send,
    };
    space.connections.set(connection.id, connection);
    const existingPresence = space.appPresence.get(member.clientId);
    if (existingPresence && existingPresence.name !== member.name) {
      space.appPresence.set(member.clientId, {
        ...existingPresence,
        name: member.name,
      });
    }

    await this.#send(space, connection, {
      type: "snapshot",
      messages: space.messages,
      members: this.#members(space),
      build: publicBuild(space.build),
      queue: this.#queueState(space),
      app: {
        revision: space.appState.revision,
        state: space.appState.values,
        presence: [...space.appPresence.values()],
      },
    });
    await this.#broadcastPresence(space);

    if (!space.build && space.queuedTurns.length > 0) {
      this.#onTurnAvailable?.(appId);
    }

    return async () => {
      if (!space.connections.delete(connection.id)) return;
      const memberStillConnected = [...space.connections.values()].some(
        (candidate) => candidate.member.clientId === member.clientId,
      );
      if (!memberStillConnected) space.appPresence.delete(member.clientId);
      await this.#broadcastPresence(space);
    };
  }

  async updateAppPresence(
    appId: string,
    member: SpaceMember,
    value: unknown,
  ) {
    const space = await this.#getReadySpace(appId);
    const normalized = normalizeAppRecord(
      value,
      "presence",
      maximumAppPresenceBytes,
    );
    const presence: SpaceAppPresence = {
      clientId: member.clientId,
      name: member.name,
      value: normalized,
      updatedAt: new Date().toISOString(),
    };
    if (!member.clientId.startsWith("guest-")) {
      for (const clientId of space.appPresence.keys()) {
        if (clientId.startsWith("guest-")) space.appPresence.delete(clientId);
      }
    }
    space.appPresence.set(member.clientId, presence);
    await this.#broadcast(space, { type: "app_presence", presence });
    return presence;
  }

  async setAppState(appId: string, key: unknown, value: unknown) {
    const space = await this.#getReadySpace(appId);
    const normalizedKey = normalizeAppKey(key);
    const normalizedValue = normalizeAppValue(value);
    const nextValues = {
      ...space.appState.values,
      [normalizedKey]: normalizedValue,
    };
    if (Object.keys(nextValues).length > maximumAppStateKeys) {
      throw new Error(`space app state supports at most ${maximumAppStateKeys} keys`);
    }
    assertJsonSize(nextValues, "space app state", maximumAppStateBytes);
    space.appState = {
      revision: space.appState.revision + 1,
      values: nextValues,
    };
    await this.#save(space);
    await this.#broadcast(space, {
      type: "app_state",
      revision: space.appState.revision,
      key: normalizedKey,
      value: normalizedValue,
    });
    return { revision: space.appState.revision };
  }

  async deleteAppState(appId: string, key: unknown) {
    const space = await this.#getReadySpace(appId);
    const normalizedKey = normalizeAppKey(key);
    if (!Object.hasOwn(space.appState.values, normalizedKey)) {
      return { revision: space.appState.revision, deleted: false };
    }
    const nextValues = { ...space.appState.values };
    delete nextValues[normalizedKey];
    space.appState = {
      revision: space.appState.revision + 1,
      values: nextValues,
    };
    await this.#save(space);
    await this.#broadcast(space, {
      type: "app_state",
      revision: space.appState.revision,
      key: normalizedKey,
      deleted: true,
    });
    return { revision: space.appState.revision, deleted: true };
  }

  async emitAppEvent(
    appId: string,
    member: SpaceMember,
    name: unknown,
    payload: unknown,
  ) {
    const space = await this.#getReadySpace(appId);
    const normalizedName = normalizeAppEventName(name);
    const normalizedPayload = normalizeAppValue(payload);
    assertJsonSize(normalizedPayload, "event payload", maximumAppEventBytes);
    const event = {
      type: "app_event",
      id: randomUUID(),
      name: normalizedName,
      payload: normalizedPayload,
      member,
      createdAt: new Date().toISOString(),
    };
    await this.#broadcast(space, event);
    return { id: event.id };
  }

  async beginTurn(appId: string, input: BeginTurnInput) {
    const space = await this.#getReadySpace(appId);
    const inflight = [...space.activeTurns, ...space.queuedTurns];
    const existing = inflight.find(
      (request) => request.externalRequestId === input.externalRequestId,
    );
    if (existing) {
      return {
        turnId: existing.turnId,
        queuePosition: inflight.findIndex((request) => request.turnId === existing.turnId) + 1,
        deduplicated: true,
      };
    }
    const completed = space.messages.find(
      (message) => message.externalRequestId === input.externalRequestId,
    );
    if (completed) {
      return { turnId: completed.turnId, queuePosition: 0, deduplicated: true };
    }
    const turnId = randomUUID();
    const createdAt = new Date().toISOString();
    const userMessage: SpaceMessage = {
      id: randomUUID(),
      turnId,
      type: "user",
      authorId: input.clientId,
      authorName: input.authorName,
      text: input.text,
      createdAt,
      externalRequestId: input.externalRequestId,
    };
    space.messages.push(userMessage);
    space.queuedTurns.push({
      turnId,
      kind: input.kind ?? "message",
      clientId: input.clientId,
      authorName: input.authorName,
      text: input.text,
      createdAt,
      externalRequestId: input.externalRequestId,
      agentId: input.agentId,
      ...(input.billing ? { billing: input.billing } : {}),
      ...(input.recovery ? { recovery: input.recovery } : {}),
    });
    const queuePosition = space.activeTurns.length + space.queuedTurns.length;
    await this.#save(space);
    await this.#broadcast(space, { type: "message", message: userMessage });
    await this.#broadcastQueue(space);
    this.#onTurnAvailable?.(appId);
    return {
      turnId,
      queuePosition,
      deduplicated: false,
    };
  }

  async claimTurn(appId: string): Promise<ClaimedSpaceTurn | null> {
    const space = await this.#getReadySpace(appId);
    if (space.build || space.activeTurns.length || !space.queuedTurns.length) {
      return null;
    }

    const firstQueued = space.queuedTurns[0];
    if (!firstQueued) return null;
    const kind = firstQueued.kind;
    const batchSize = kind !== "message"
      ? 1
      : space.queuedTurns.findIndex(
          (request) => request.kind !== kind || request.agentId !== firstQueued.agentId,
        );
    space.activeTurns = space.queuedTurns.splice(
      0,
      batchSize < 0 ? space.queuedTurns.length : batchSize,
    );
    const [first] = space.activeTurns;
    if (!first) return null;
    space.build = {
      turnId: first.turnId,
      authorName: first.authorName,
      requestCount: space.activeTurns.length,
      startedAt: new Date().toISOString(),
      stage:
        kind === "restore"
          ? "Kernel 正在恢复默认 Chat App"
          : space.activeTurns.length > 1
          ? `${first.agentId} 正在理解 ${space.activeTurns.length} 条消息`
          : `${first.agentId} 正在理解消息`,
      agentText: "",
      activities: [],
      agentId: first.agentId,
    };
    await this.#save(space);
    await this.#broadcast(space, { type: "turn_started", turn: space.build });
    await this.#broadcastQueue(space);
    return { turnId: first.turnId, kind, requests: [...space.activeTurns] };
  }

  async progress(appId: string, turnId: string, event: SpaceBuildProgress) {
    const space = await this.#getReadySpace(appId);
    if (!space.build || space.build.turnId !== turnId) return;

    if (event.type === "status") {
      space.build.stage = event.message;
    } else if (event.type === "agent_delta") {
      space.build.agentText += event.text;
    } else if (event.type === "activity") {
      const key = event.toolCallId || event.label;
      const index = space.build.activities.findIndex(
        (item) => (item.toolCallId || item.label) === key,
      );
      if (index >= 0) space.build.activities[index] = event;
      else space.build.activities.unshift(event);
      space.build.activities = space.build.activities.slice(0, 4);
    } else if (event.type === "workspace") {
      space.build.draftFiles = event.files;
      space.build.stage = event.changedPath
        ? `${event.changedPath} 已同步，准备实时构建`
        : "最新代码已同步，准备实时构建";
    }

    await this.#broadcast(
      space,
      event.type === "workspace"
        ? { type: "workspace", changedPath: event.changedPath }
        : event,
    );
  }

  async snapshot(appId: string) {
    const space = await this.#getReadySpace(appId);
    return {
      messages: space.messages,
      members: this.#members(space),
      build: publicBuild(space.build),
      queue: this.#queueState(space),
      app: {
        revision: space.appState.revision,
        state: space.appState.values,
        presence: [...space.appPresence.values()],
      },
    };
  }

  async heartbeat(appId: string, turnId: string, elapsedSeconds: number) {
    const space = await this.#getReadySpace(appId);
    if (!space.build || space.build.turnId !== turnId) return;
    await this.#broadcast(space, { type: "heartbeat", elapsedSeconds });
  }

  async announce(appId: string, event: SpaceEvent) {
    const space = await this.#getReadySpace(appId);
    await this.#broadcast(space, event);
  }

  async complete(
    appId: string,
    turnId: string,
    fallbackText: string,
    deployed: SpaceEvent,
  ) {
    const space = await this.#getReadySpace(appId);
    if (!space.build || space.build.turnId !== turnId) return;

    const message: SpaceMessage = {
      id: randomUUID(),
      turnId,
      type: "agent",
      authorId: space.build.agentId,
      authorName: space.build.agentId === "pi" ? "Pi" : space.build.agentId,
      text: space.build.agentText.trim() || fallbackText,
      createdAt: new Date().toISOString(),
    };
    space.messages.push(message);
    space.build = null;
    space.activeTurns = [];
    await this.#save(space);
    await this.#broadcast(space, { type: "message", message });
    await this.#broadcast(space, deployed);
    await this.#broadcastQueue(space);
  }

  async completeChat(appId: string, turnId: string, fallbackText: string) {
    const space = await this.#getReadySpace(appId);
    if (!space.build || space.build.turnId !== turnId) return;

    const message: SpaceMessage = {
      id: randomUUID(),
      turnId,
      type: "agent",
      authorId: space.build.agentId,
      authorName: space.build.agentId === "pi" ? "Pi" : space.build.agentId,
      text: space.build.agentText.trim() || fallbackText,
      createdAt: new Date().toISOString(),
    };
    space.messages.push(message);
    space.build = null;
    space.activeTurns = [];
    await this.#save(space);
    await this.#broadcast(space, { type: "message", message });
    await this.#broadcast(space, { type: "chat_completed", turnId });
    await this.#broadcastQueue(space);
  }

  async fail(appId: string, turnId: string, messageText: string, code?: string) {
    const space = await this.#getReadySpace(appId);
    if (!space.build || space.build.turnId !== turnId) return;

    const message: SpaceMessage = {
      id: randomUUID(),
      turnId,
      type: "error",
      authorId: "system",
      authorName: "ERROR",
      text: messageText,
      createdAt: new Date().toISOString(),
    };
    space.messages.push(message);
    space.build = null;
    space.activeTurns = [];
    await this.#save(space);
    await this.#broadcast(space, { type: "message", message });
    await this.#broadcast(space, {
      type: "turn_failed",
      message: messageText,
      ...(code ? { code } : {}),
    });
    await this.#broadcastQueue(space);
  }

  async #getReadySpace(appId: string) {
    assertAppId(appId);
    let space = this.#spaces.get(appId);
    if (!space) {
      space = {
        appId,
        messages: [],
        appState: { revision: 0, values: {} },
        appPresence: new Map(),
        queuedTurns: [],
        activeTurns: [],
        connections: new Map(),
        sequence: 0,
        build: null,
        ready: Promise.resolve(),
        saveQueue: Promise.resolve(),
      };
      space.ready = this.#load(space);
      this.#spaces.set(appId, space);
    }
    await space.ready;
    return space;
  }

  async #load(space: LocalSpace) {
    try {
      const contents = await readFile(this.#path(space.appId), "utf8");
      const value = JSON.parse(contents) as {
        messages?: unknown;
        appState?: unknown;
        queuedTurns?: unknown;
        activeTurns?: unknown;
      };
      if (Array.isArray(value.messages)) {
        space.messages = value.messages
          .filter(isSpaceMessage)
          .slice(-maximumStoredMessages);
      }
      const storedAppState = readStoredAppState(value.appState);
      if (storedAppState) space.appState = storedAppState;
      const interrupted = Array.isArray(value.activeTurns)
        ? value.activeTurns.filter(isSpaceTurnRequest)
        : [];
      const queued = Array.isArray(value.queuedTurns)
        ? value.queuedTurns.filter(isSpaceTurnRequest)
        : [];
      space.queuedTurns = [...interrupted, ...queued];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  async #save(space: LocalSpace) {
    space.messages = space.messages.slice(-maximumStoredMessages);
    const snapshot = `${JSON.stringify(
      {
        messages: space.messages,
        appState: space.appState,
        queuedTurns: space.queuedTurns,
        activeTurns: space.activeTurns,
      },
      null,
      2,
    )}\n`;
    space.saveQueue = space.saveQueue.then(async () => {
      await mkdir(spaceDirectory, { recursive: true });
      const path = this.#path(space.appId);
      const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(temporaryPath, snapshot, "utf8");
      await rename(temporaryPath, path);
    });
    await space.saveQueue;
  }

  #path(appId: string) {
    return join(spaceDirectory, `${appId}.json`);
  }

  #members(space: LocalSpace) {
    return [
      ...new Map(
        [...space.connections.values()].map((connection) => [
          connection.member.clientId,
          connection.member,
        ]),
      ).values(),
    ];
  }

  async #broadcastPresence(space: LocalSpace) {
    await this.#broadcast(space, {
      type: "presence",
      members: this.#members(space),
      appPresence: [...space.appPresence.values()],
    });
  }

  #queueState(space: LocalSpace): SpaceQueueState {
    return {
      activeCount: space.activeTurns.length,
      pendingCount: space.queuedTurns.length,
    };
  }

  async #broadcastQueue(space: LocalSpace) {
    await this.#broadcast(space, {
      type: "queue_updated",
      ...this.#queueState(space),
    });
  }

  async #broadcast(space: LocalSpace, event: SpaceEvent) {
    const failed: string[] = [];
    await Promise.all(
      [...space.connections.values()].map(async (connection) => {
        try {
          await this.#send(space, connection, event);
        } catch {
          failed.push(connection.id);
        }
      }),
    );
    for (const id of failed) space.connections.delete(id);
  }

  async #send(space: LocalSpace, connection: SpaceConnection, event: SpaceEvent) {
    space.sequence += 1;
    await connection.send({ ...event, spaceSequence: space.sequence });
  }
}

function isSpaceMessage(value: unknown): value is SpaceMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<SpaceMessage>;
  return (
    typeof message.id === "string" &&
    typeof message.turnId === "string" &&
    (message.type === "user" ||
      message.type === "agent" ||
      message.type === "error") &&
    typeof message.authorId === "string" &&
    typeof message.authorName === "string" &&
    typeof message.text === "string" &&
    typeof message.createdAt === "string"
  );
}

function publicBuild(build: ActiveSpaceBuild | null) {
  if (!build) return null;
  const { draftFiles: _draftFiles, ...safe } = build;
  return safe;
}

function isSpaceTurnRequest(value: unknown): value is SpaceTurnRequest {
  if (!value || typeof value !== "object") return false;
  const request = value as Partial<SpaceTurnRequest>;
  return (
    typeof request.turnId === "string" &&
    (request.kind === "message" || request.kind === "publish" || request.kind === "restore") &&
    typeof request.clientId === "string" &&
    typeof request.authorName === "string" &&
    typeof request.text === "string" &&
    typeof request.createdAt === "string" &&
    typeof request.externalRequestId === "string" &&
    typeof request.agentId === "string" &&
    (request.kind !== "restore" || (
      request.recovery?.target === "default-chat" &&
      typeof request.recovery.expectedReadyRevisionId === "string" &&
      /^[a-f0-9]{16}$/.test(request.recovery.expectedReadyRevisionId)
    ))
  );
}

function normalizeAppKey(value: unknown) {
  if (
    typeof value !== "string" ||
    !safeAppKeyPattern.test(value) ||
    unsafeObjectKeys.has(value)
  ) {
    throw new Error(
      "state key must be 1-64 safe letters, numbers, dots, colons, underscores, or dashes",
    );
  }
  return value;
}

function normalizeAppEventName(value: unknown) {
  if (typeof value !== "string" || !safeAppKeyPattern.test(value)) {
    throw new Error(
      "event name must be 1-64 safe letters, numbers, dots, colons, underscores, or dashes",
    );
  }
  return value;
}

function normalizeAppRecord(
  value: unknown,
  label: string,
  maximumBytes: number,
) {
  const normalized = normalizeAppValue(value);
  if (!normalized || Array.isArray(normalized) || typeof normalized !== "object") {
    throw new Error(`${label} must be a JSON object`);
  }
  assertJsonSize(normalized, label, maximumBytes);
  return normalized;
}

function normalizeAppValue(value: unknown, depth = 0): SpaceAppValue {
  if (depth > maximumAppValueDepth) {
    throw new Error(`space app values may be at most ${maximumAppValueDepth} levels deep`);
  }
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("space app numbers must be finite");
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeAppValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const normalized: Record<string, SpaceAppValue> = {};
    for (const [key, item] of Object.entries(value)) {
      if (unsafeObjectKeys.has(key)) {
        throw new Error(`space app object key ${key} is not allowed`);
      }
      normalized[key] = normalizeAppValue(item, depth + 1);
    }
    return normalized;
  }
  throw new Error("space app values must contain JSON-compatible data only");
}

function assertJsonSize(value: SpaceAppValue, label: string, maximumBytes: number) {
  const size = Buffer.byteLength(JSON.stringify(value), "utf8");
  if (size > maximumBytes) {
    throw new Error(`${label} exceeds ${maximumBytes} bytes`);
  }
}

function readStoredAppState(value: unknown): SpaceAppState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const stored = value as { revision?: unknown; values?: unknown };
  try {
    const values = normalizeAppRecord(
      stored.values ?? {},
      "space app state",
      maximumAppStateBytes,
    );
    if (Object.keys(values).length > maximumAppStateKeys) return null;
    return {
      revision:
        typeof stored.revision === "number" &&
        Number.isSafeInteger(stored.revision) &&
        stored.revision >= 0
          ? stored.revision
          : 0,
      values,
    };
  } catch {
    return null;
  }
}
