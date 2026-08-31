import { createClient } from "@rivet-dev/agentos/client";
import { deployApp } from "@rivet-dev/agentos-apps";
import type { AgentOsAppBuildRegistry } from "../../actors.js";
import type {
  AppCandidateFactory,
  AppCandidateHandle,
  AppExecutionRuntime,
  AppReleaseExecutor,
  AppReleaseInput,
} from "../contract.js";

const client = createClient<AgentOsAppBuildRegistry>({
  endpoint:
    process.env.RIVET_ENDPOINT ??
    process.env.AGENTOS_ENDPOINT ??
    "http://127.0.0.1:6420",
  poolName: process.env.SPACE_APP_BUILD_POOL_CLASS ?? "app-build",
});

type AgentOsAppExecutionVm = ReturnType<typeof client.appBuildVm.getOrCreate>;

class AgentOsCandidateHandle implements AppCandidateHandle {
  readonly #vm: AgentOsAppExecutionVm;

  constructor(vm: AgentOsAppExecutionVm) {
    this.#vm = vm;
  }

  makeDirectory(path: string) {
    return this.#vm.filesystem.mkdir(path, { recursive: true });
  }

  async writeFiles(files: Array<{ path: string; content: string }>) {
    await this.#vm.filesystem.writeFiles(files);
  }

  async start(input: {
    entryPath: string;
    cwd: string;
    env: Record<string, string>;
  }) {
    const process = await this.#vm.javascript.spawnFile(input.entryPath, {
      cwd: input.cwd,
      env: input.env,
      output: { retainEvents: true },
    });
    return { processId: process.pid };
  }

  fetch(
    port: number,
    url: string,
    request?: {
      method?: string;
      headers?: Record<string, string>;
      body?: Uint8Array;
    },
  ) {
    return this.#vm.vmFetch(port, url, request);
  }

  stop(processId: number) {
    return this.#vm.process.kill(processId);
  }

  async readOutput(processId: number) {
    const captured = await this.#vm.process.readOutput(processId);
    return captured.events
      .map((event) =>
        Buffer.from(event.chunk.data, "base64").toString("utf8"),
      )
      .join("");
  }
}

const createAgentOsCandidate: AppCandidateFactory = (actorKey) =>
  new AgentOsCandidateHandle(client.appBuildVm.getOrCreate(actorKey));

const deployAgentOsRelease: AppReleaseExecutor = async (
  input: AppReleaseInput,
) => {
  const deployment = await deployApp({
    appId: input.spaceInstanceId,
    files: input.files,
    scaling: input.scaling,
  }, { client });
  return {
    releaseId: deployment.release,
    deployment: deployment as unknown as Record<string, unknown>,
  };
};

export class AgentOsAppExecutionRuntime implements AppExecutionRuntime {
  readonly #createCandidate: AppCandidateFactory;
  readonly #deploy: AppReleaseExecutor;

  constructor(
    createCandidate: AppCandidateFactory = createAgentOsCandidate,
    deploy: AppReleaseExecutor = deployAgentOsRelease,
  ) {
    this.#createCandidate = createCandidate;
    this.#deploy = deploy;
  }

  openCandidate(actorKey: string) {
    return this.#createCandidate(actorKey);
  }

  deployRelease(input: AppReleaseInput) {
    return this.#deploy(input);
  }
}
