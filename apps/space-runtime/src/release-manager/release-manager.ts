import type { AppExecutionRuntime } from "../app-runtime/contract.js";
import type { ProjectFiles } from "../project-store.js";
import type { SpaceBuildProgress } from "../space-instance-server.js";
import { defaultSpaceReleaseScaling } from "./policy.js";

export interface ReleaseDeployment {
  releaseId: string;
  deployment: Record<string, unknown>;
}

export class ReleaseManager {
  readonly #runtime: AppExecutionRuntime;

  constructor(runtime: AppExecutionRuntime) {
    this.#runtime = runtime;
  }

  async deploy(input: {
    spaceInstanceId: string;
    files: ProjectFiles;
    onProgress: (event: SpaceBuildProgress) => Promise<void>;
  }): Promise<ReleaseDeployment> {
    await input.onProgress({
      type: "status",
      stage: "publishing",
      message: "正在构建不可变 release 并正式发布…",
    });
    const result = await this.#runtime.deployRelease({
      spaceInstanceId: input.spaceInstanceId,
      files: input.files,
      scaling: defaultSpaceReleaseScaling,
    });
    return {
      releaseId: result.releaseId,
      deployment: result.deployment,
    };
  }
}
