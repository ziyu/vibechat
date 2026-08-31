import { createSpaceRuntimeConfig } from "./composition/runtime-config.js";
import {
  parseAgentOsPoolWorkload,
  startAgentOsPoolWorker,
} from "./infrastructure/pool-worker.js";

void main().catch((error) => {
  console.error("Space Runtime AgentOS pool worker failed", error);
  process.exit(1);
});

async function main() {
  const workload = parseAgentOsPoolWorkload(
    process.env.SPACE_RUNTIME_POOL_WORKLOAD,
  );
  const worker = await startAgentOsPoolWorker(
    createSpaceRuntimeConfig(),
    workload,
  );
  const ready = {
    type: "space-runtime-pool-ready",
    workload: worker.workload,
    poolName: worker.poolName,
    engineIdentity: worker.engineIdentity,
    pid: process.pid,
  } as const;

  console.log(
    `[space-runtime-pool] ${worker.workload} ready in ${worker.poolName} at ${worker.engineIdentity}`,
  );
  process.send?.(ready);

  process.once("disconnect", () => {
    void worker.registry.shutdown().finally(() => process.exit(0));
  });
}
