import { fork, type ChildProcess } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  spaceBackendCallbackAudience,
  verifySpaceRuntimeCredential,
} from "@vibechat/space-runtime-auth";

const databasePath = `/tmp/vibechat-space-runtime-replicas-${process.pid}-${Date.now()}.sqlite`;
const signingSecret = "space-runtime-replica-harness-secret";
const spaceInstanceId = "space-instance-replica-harness";
const projectId = "project-replica-harness";
const turnId = "turn-replica-harness";
const sessionId = "session-replica-harness-1";
const definitionId = "agent-definition-pi-v1";
let now = new Date();
let database: typeof import("@libs/database");
let control: import("@libs/space-runtime-control").DatabaseSpaceRuntimeControlPlane;
let agents: import("../../libs/space-agents/database-repository").DatabaseSpaceAgentRepository;
let backendServer: Server;
let engineServer: Server;
let backendOrigin: string;
let engineOrigin: string;
const objects = new Map<string, Uint8Array>();
const replicas: ChildProcess[] = [];

beforeAll(async () => {
  process.env.DB_DIALECT = "sqlite";
  process.env.SQLITE_DB_PATH = databasePath;
  vi.resetModules();
  database = await import("@libs/database");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const { DatabaseSpaceRuntimeControlPlane } = await import(
    "@libs/space-runtime-control"
  );
  const { DatabaseSpaceAgentRepository } = await import(
    "../../libs/space-agents/database-repository"
  );
  migrate(database.db as never, {
    migrationsFolder: "libs/database/drizzle-sqlite",
  });
  control = new DatabaseSpaceRuntimeControlPlane(() => new Date(now));
  agents = new DatabaseSpaceAgentRepository();
  engineServer = createServer((request, response) => {
    if (request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ runtime: "engine", status: "ok" }));
      return;
    }
    response.writeHead(404).end();
  });
  engineOrigin = await listen(engineServer);
  backendServer = createServer((request, response) => {
    void handleBackendRequest(request, response).catch((error) => {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(
        JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      );
    });
  });
  backendOrigin = await listen(backendServer);
});

afterAll(async () => {
  for (const replica of replicas) replica.kill("SIGTERM");
  await Promise.all([
    close(backendServer),
    close(engineServer),
  ]);
  database.sqliteInstance?.close();
  for (const suffix of ["", "-shm", "-wal"]) {
    const path = `${databasePath}${suffix}`;
    if (existsSync(path)) rmSync(path, { force: true });
  }
  delete process.env.SQLITE_DB_PATH;
  delete process.env.DB_DIALECT;
});

describe("Space Runtime multi-process failover harness", () => {
  it("connects two replica identities to one external Engine and fences stale writes while restoring session and Release pointers", async () => {
    const session = agentSession(1, sessionId);
    await agents.saveSession(session);
    await control.enqueueTurn({
      turnId,
      spaceInstanceId,
      externalRequestId: "matrix-replica-harness",
      kind: "message",
      agentId: "pi",
      agentDefinitionId: definitionId,
      agentDefinitionVersion: "1.0.0",
      adapterKey: "pi",
      adapterVersion: "0.2.7",
      sessionGeneration: 1,
      policySnapshotHash: `sha256:${"a".repeat(64)}`,
      payloadSchemaVersion: "vibechat.agent-turn-input/v1",
      payload: turnRequest(),
    });

    const replicaA = await startReplica("runtime-a");
    const replicaB = await startReplica("runtime-b");
    expect(replicaA.ready).toMatchObject({
      replicaId: "runtime-a",
      ownerId: "runtime-a",
      engineIdentity: engineOrigin,
      engineOwnership: "external",
      pools: {
        agentExecution: "agent-harness",
        appBuild: "build-harness",
        releaseServing: "serving-harness",
      },
    });
    expect(replicaB.ready).toMatchObject({
      replicaId: "runtime-b",
      ownerId: "runtime-b",
      engineIdentity: engineOrigin,
    });

    await expect(replicaA.command({
      action: "claim",
      spaceInstanceId,
    })).resolves.toMatchObject({ turnId });
    await expect(replicaB.command({
      action: "claim",
      spaceInstanceId,
    })).resolves.toBeNull();
    await replicaA.command({
      action: "save-project",
      project: storedProject(),
    });
    await replicaA.command({
      action: "save-instance",
      spaceInstanceId,
      sequence: 1,
      snapshot: { owner: "runtime-a" },
    });

    now = new Date(now.getTime() + 31_000);
    await expect(replicaB.command({
      action: "claim",
      spaceInstanceId,
    })).resolves.toMatchObject({ turnId });
    await expect(replicaA.command({
      action: "complete",
      spaceInstanceId,
      turnId,
      status: "completed",
    })).rejects.toThrow(/fenced|lease|another replica/i);
    await expect(replicaA.command({
      action: "save-instance",
      spaceInstanceId,
      sequence: 99,
      snapshot: { owner: "stale-runtime-a" },
    })).rejects.toThrow(/fenced|lease|another replica/i);

    await expect(replicaB.command({
      action: "load-project",
      spaceInstanceId,
    })).resolves.toMatchObject({
      appId: spaceInstanceId,
      draftId: "revision-ready-1",
      publishedDraftId: "revision-published-1",
      releaseId: "release-immutable-1",
    });
    await expect(replicaB.command({
      action: "load-session",
      input: {
        spaceInstanceId,
        agentId: "pi",
        sessionId,
        generation: 1,
      },
    })).resolves.toMatchObject({ sessionId, generation: 1 });
    const rebuilt = await replicaB.command({
      action: "rebuild-session",
      input: { turnId, session },
    });
    expect(rebuilt).toMatchObject({
      spaceInstanceId,
      agentId: "pi",
      generation: 2,
      providerSessionRef: null,
      restoreStatus: "restoring",
    });
    await expect(replicaB.command({
      action: "complete",
      spaceInstanceId,
      turnId,
      status: "completed",
    })).resolves.toBe(true);

    expect(await control.getTurn(turnId)).toMatchObject({
      status: "completed",
      attempt: 2,
      ownerId: "runtime-b",
      fencingToken: 2,
    });
    expect(await control.loadInstance(spaceInstanceId)).toMatchObject({
      sequence: 1,
      snapshot: { owner: "runtime-a" },
      fencingToken: 2,
    });
  }, 30_000);
});

async function handleBackendRequest(
  request: import("node:http").IncomingMessage,
  response: import("node:http").ServerResponse,
) {
  const url = new URL(request.url || "/", backendOrigin);
  const credential = request.headers.authorization?.replace(/^Bearer\s+/i, "") || "";
  const authorized = await verifySpaceRuntimeCredential(credential, {
    secret: signingSecret,
    audience: spaceBackendCallbackAudience,
    subject: "space-runtime",
    method: request.method || "GET",
    path: url.pathname,
  });
  if (!authorized) return json(response, 401, { error: "unauthorized" });

  const objectMatch = /^\/v1\/internal\/space-runtime-objects\/([a-f0-9]{64})$/.exec(
    url.pathname,
  );
  if (objectMatch) {
    const hash = objectMatch[1]!;
    if (request.method === "PUT") {
      objects.set(hash, await readBytes(request));
      return json(response, 200, {
        objectKey: `space-runtime/objects/${hash}`,
      });
    }
    const object = objects.get(hash);
    if (!object) return json(response, 404, { error: "not_found" });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(object);
    return;
  }
  if (url.pathname !== "/v1/internal/space-runtime-control") {
    return json(response, 404, { error: "not_found" });
  }

  const body = JSON.parse(new TextDecoder().decode(await readBytes(request))) as any;
  try {
    if (body.action === "claim_lease") {
      const lease = await control.claimLease(body.spaceInstanceId, body.ownerId, body.ttlMs);
      return json(response, 200, { lease: lease && serializeLease(lease) });
    }
    if (body.action === "renew_lease") {
      const lease = await control.renewLease(parseLease(body.lease), body.ttlMs);
      return json(response, 200, { lease: lease && serializeLease(lease) });
    }
    if (body.action === "claim_turn") {
      const lease = await control.claimLease(body.spaceInstanceId, body.ownerId, body.ttlMs);
      if (!lease) return json(response, 200, { lease: null, turn: null });
      const turn = await control.claimNextTurn(body.spaceInstanceId, lease);
      return json(response, 200, {
        lease: serializeLease(lease),
        turn: turn && serializeTurn(turn),
      });
    }
    if (body.action === "complete_turn") {
      const completed = await control.completeTurn(
        body.turnId,
        parseLease(body.lease),
        body.status,
      );
      return json(response, 200, { completed });
    }
    if (body.action === "save_instance") {
      const instance = await control.saveInstance(body.instance, parseLease(body.lease));
      return json(response, 200, { instance });
    }
    if (body.action === "load_project") {
      const project = await control.loadProject(body.spaceInstanceId);
      return json(response, 200, {
        projectId,
        project: project && { ...project, updatedAt: project.updatedAt.toISOString() },
      });
    }
    if (body.action === "save_project") {
      const project = await control.saveProject(body.project, parseLease(body.lease));
      return json(response, 200, {
        project: { ...project, updatedAt: project.updatedAt.toISOString() },
      });
    }
    if (body.action === "load_agent_session") {
      const session = await agents.findSession(body.sessionId);
      const matches = session
        && session.spaceInstanceId === body.spaceInstanceId
        && session.agentId === body.agentId
        && session.generation === body.generation;
      return json(response, 200, { session: matches ? session : null });
    }
    if (body.action === "rebuild_agent_session") {
      const lease = parseLease(body.lease);
      await control.assertLease(lease);
      const turn = await control.getTurn(body.turnId);
      const session = await agents.findSession(body.sessionId);
      if (
        !turn
        || turn.status !== "active"
        || turn.ownerId !== lease.ownerId
        || turn.fencingToken !== lease.fencingToken
        || !session
        || session.generation !== body.generation
      ) return json(response, 403, { error: "not_allowed" });
      const { SpaceAgentSessionService } = await import(
        "../../libs/space-agents/sessions/service"
      );
      const rebuilt = await new SpaceAgentSessionService(
        agents,
        () => "session-replica-harness-2",
      ).rebuild({ session, now });
      return json(response, 200, { session: rebuilt });
    }
    return json(response, 200, { reconciled: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "SPACE_RUNTIME_FENCED") {
      return json(response, 409, { error: "SPACE_RUNTIME_FENCED" });
    }
    throw error;
  }
}

async function startReplica(replicaId: string) {
  const worker = new URL(
    "./fixtures/space-runtime-replica-worker.mts",
    import.meta.url,
  );
  const child = fork(worker, [], {
    execArgv: ["--import", "tsx"],
    env: {
      ...process.env,
      NODE_ENV: "production",
      PI_MODE: "agentos",
      SPACE_RUNTIME_ENGINE_MODE: "external",
      SPACE_RUNTIME_REPLICA_ID: replicaId,
      SPACE_RUNTIME_REGION: "test-region",
      SPACE_AGENT_EXECUTION_POOL_CLASS: "agent-harness",
      SPACE_APP_BUILD_POOL_CLASS: "build-harness",
      SPACE_RELEASE_SERVING_POOL_CLASS: "serving-harness",
      SPACE_AGENT_EGRESS_ALLOWLIST: "deny",
      SPACE_APP_BUILD_EGRESS_ALLOWLIST: "deny",
      SPACE_RELEASE_EGRESS_ALLOWLIST: "deny",
      RIVET_ENDPOINT: engineOrigin,
      SPACE_RUNTIME_CALLBACK_ORIGIN: backendOrigin,
      SPACE_RUNTIME_INTERNAL_TOKEN: signingSecret,
    },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  replicas.push(child);
  let diagnostics = "";
  child.stderr?.on("data", (chunk) => {
    diagnostics = `${diagnostics}${String(chunk)}`.slice(-4_000);
  });
  const ready = await waitForMessage(
    child,
    (message) => message.type === "ready",
    () => diagnostics,
  );
  let commandId = 0;
  return {
    ready,
    command(input: Record<string, unknown>) {
      const id = ++commandId;
      child.send({ id, ...input });
      return waitForMessage(child, (message) => message.id === id).then(
        (message) => {
          if (!message.ok) throw new Error(message.error);
          return message.result;
        },
      );
    },
  };
}

function waitForMessage(
  child: ChildProcess,
  predicate: (message: any) => boolean,
  diagnostics: () => string = () => "",
) {
  return new Promise<any>((resolve, reject) => {
    const onMessage = (message: any) => {
      if (!predicate(message)) return;
      cleanup();
      resolve(message);
    };
    const onExit = (code: number | null) => {
      cleanup();
      reject(new Error(
        `replica worker exited before responding (${code})${diagnostics() ? `: ${diagnostics()}` : ""}`,
      ));
    };
    const cleanup = () => {
      child.off("message", onMessage);
      child.off("exit", onExit);
    };
    child.on("message", onMessage);
    child.on("exit", onExit);
  });
}

function turnRequest() {
  const requestedAt = now.toISOString();
  return {
    turnId,
    kind: "message",
    clientId: "member-1",
    authorName: "Member One",
    text: "fail over this Turn",
    createdAt: requestedAt,
    externalRequestId: "matrix-replica-harness",
    agentId: "pi",
    agentTurn: {
      schemaVersion: "vibechat.agent-turn-input/v1",
      turnId,
      spaceInstanceId,
      agentId: "pi",
      sessionId,
      sessionGeneration: 1,
      definition: {
        definitionId,
        agentId: "pi",
        version: "1.0.0",
        adapterKey: "pi",
        adapterVersion: "0.2.7",
        provider: "pi",
        model: "configured",
        capabilities: ["conversation", "revision"],
        toolPolicyId: "space-project-v1",
        pricingPolicyId: "space-agent-default-v1",
        usageSchemaVersion: "vibechat.agent-usage/v1",
        maxBudgetCredits: 100,
        maxConcurrency: 1,
        dataRegionPolicy: ["test-region"],
        displayName: "Pi",
        description: "Harness Pi",
        status: "active",
        availability: "available",
        createdAt: requestedAt,
        updatedAt: requestedAt,
      },
      policy: {
        schemaVersion: "vibechat.agent-policy/v1",
        policySnapshotHash: `sha256:${"a".repeat(64)}`,
        permissionPolicyId: "space-agent-member-v1",
        toolPolicyId: "space-project-v1",
        pricingPolicyId: "space-agent-default-v1",
        maxCredits: 100,
        maxInputTokens: 1_000,
        maxOutputTokens: 1_000,
        allowedTools: ["project.read", "project.write"],
      },
      context: {
        matrixEventIds: ["$event-replica-harness"],
        messageWindowRef: null,
        summaryRef: null,
      },
      project: {
        projectId,
        revisionId: "revision-ready-1",
        sourceHash: `sha256:${"b".repeat(64)}`,
      },
      requestText: "fail over this Turn",
      requestedAt,
    },
  };
}

function agentSession(generation: number, id: string) {
  const timestamp = now.toISOString();
  return {
    schemaVersion: "vibechat.agent-session-ref/v1" as const,
    sessionId: id,
    spaceInstanceId,
    agentId: "pi",
    definitionId,
    definitionVersion: "1.0.0",
    adapterKey: "pi",
    adapterVersion: "0.2.7",
    generation,
    providerSessionRef: null,
    summaryRef: "summary-replica-harness",
    summaryHash: `sha256:${"c".repeat(64)}`,
    region: "test-region",
    restoreStatus: "rebuild_required" as const,
    lastTurnId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function storedProject() {
  return {
    appId: spaceInstanceId,
    files: {
      "package.json": "{}\n",
      "tsconfig.json": "{}\n",
      "src/index.ts": "export const release = 'immutable';\n",
    },
    sourceHash: `sha256:${"d".repeat(64)}` as const,
    summary: "Immutable harness Release",
    updatedAt: now.toISOString(),
    draftId: "revision-ready-1",
    publishedDraftId: "revision-published-1",
    releaseId: "release-immutable-1",
  };
}

function parseLease(lease: any) {
  return { ...lease, expiresAt: new Date(lease.expiresAt) };
}

function serializeLease(lease: import("@libs/space-runtime-control").RuntimeLease) {
  return { ...lease, expiresAt: lease.expiresAt.toISOString() };
}

function serializeTurn(turn: import("@libs/space-runtime-control").RuntimeTurnRecord) {
  return {
    ...turn,
    cancelRequestedAt: turn.cancelRequestedAt?.toISOString() || null,
    createdAt: turn.createdAt.toISOString(),
    updatedAt: turn.updatedAt.toISOString(),
  };
}

function json(
  response: import("node:http").ServerResponse,
  status: number,
  body: unknown,
) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readBytes(request: import("node:http").IncomingMessage) {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

function listen(server: Server) {
  return new Promise<string>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("server did not bind a TCP port"));
        return;
      }
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function close(server: Server | undefined) {
  return new Promise<void>((resolve) => {
    if (!server?.listening) return resolve();
    server.close(() => resolve());
  });
}
