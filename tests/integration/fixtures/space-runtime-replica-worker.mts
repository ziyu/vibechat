import { BackendDurableSpaceControl } from "../../../apps/space-runtime/src/durable-space-control.js";
import { BackendRemoteProjectStore } from "../../../apps/space-runtime/src/remote-project-store.js";
import { startAgentOsInfrastructure } from "../../../apps/space-runtime/src/composition/agentos-infrastructure.js";
import { createSpaceRuntimeConfig } from "../../../apps/space-runtime/src/composition/runtime-config.js";
import { runtimeReplicaOwnerId } from "../../../apps/space-runtime/src/runtime-replica.js";

let durableControl: BackendDurableSpaceControl;
let projectStore: BackendRemoteProjectStore;

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const callbackOrigin = requiredEnvironment("SPACE_RUNTIME_CALLBACK_ORIGIN");
  const signingSecret = requiredEnvironment("SPACE_RUNTIME_INTERNAL_TOKEN");
  const config = createSpaceRuntimeConfig();
  durableControl = new BackendDurableSpaceControl(callbackOrigin, signingSecret);
  projectStore = new BackendRemoteProjectStore(callbackOrigin, signingSecret);

  await startAgentOsInfrastructure(config, {
    environment: process.env,
    makeDirectory: async () => undefined,
    checkEngine: async (endpoint) => {
      const response = await fetch(new URL("/health", `${endpoint}/`));
      return { ok: response.ok, status: response.status };
    },
    // Pool/Registry shape is covered independently. The multi-process harness
    // exercises external Engine preflight plus the production Backend clients.
    startManagedPoolWorkers: async () => {
      throw new Error("Replica harness must not start managed pool workers");
    },
  });

  process.send?.({
    type: "ready",
    replicaId: config.deployment.replica.id,
    ownerId: runtimeReplicaOwnerId,
    engineIdentity: config.deployment.engine.publicIdentity,
    engineOwnership: config.deployment.engine.ownership,
    pools: config.deployment.pools,
  });

  process.on("message", (message: ReplicaCommand) => {
    void execute(message).then(
      (result) => process.send?.({ id: message.id, ok: true, result }),
      (error) =>
        process.send?.({
          id: message.id,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }),
    );
  });
}

async function execute(message: ReplicaCommand) {
  switch (message.action) {
    case "claim":
      return durableControl.claimTurn(message.spaceInstanceId);
    case "complete":
      return durableControl.completeTurn(
        message.spaceInstanceId,
        message.turnId,
        message.status,
      );
    case "save-instance":
      return durableControl.saveInstance(
        message.spaceInstanceId,
        message.sequence,
        message.snapshot,
      );
    case "load-session":
      return durableControl.loadAgentSession(message.input);
    case "rebuild-session":
      return durableControl.rebuildAgentSession(message.input);
    case "save-project":
      return projectStore.save(message.project);
    case "load-project":
      return projectStore.load(message.spaceInstanceId);
    case "stop":
      process.exit(0);
  }
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required by the replica harness`);
  return value;
}

type ReplicaCommand =
  | { id: number; action: "claim"; spaceInstanceId: string }
  | {
      id: number;
      action: "complete";
      spaceInstanceId: string;
      turnId: string;
      status: "completed" | "failed";
    }
  | {
      id: number;
      action: "save-instance";
      spaceInstanceId: string;
      sequence: number;
      snapshot: Record<string, unknown>;
    }
  | {
      id: number;
      action: "load-session";
      input: Parameters<BackendDurableSpaceControl["loadAgentSession"]>[0];
    }
  | {
      id: number;
      action: "rebuild-session";
      input: Parameters<BackendDurableSpaceControl["rebuildAgentSession"]>[0];
    }
  | {
      id: number;
      action: "save-project";
      project: Parameters<BackendRemoteProjectStore["save"]>[0];
    }
  | {
      id: number;
      action: "load-project";
      spaceInstanceId: string;
    }
  | { id: number; action: "stop" };
