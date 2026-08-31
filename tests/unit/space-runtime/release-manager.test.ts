import { describe, expect, it, vi } from "vitest";
import type { AppExecutionRuntime } from "../../../apps/space-runtime/src/app-runtime/contract";
import {
  ReleaseManager,
} from "../../../apps/space-runtime/src/release-manager/release-manager";

describe("ReleaseManager", () => {
  it("applies the fixed Space Release policy and preserves deployment details", async () => {
    const deployment = { release: "release-1", endpoint: "/runtime/apps/app-1" };
    const runtime: AppExecutionRuntime = {
      openCandidate: vi.fn(() => {
        throw new Error("Candidate is not used by ReleaseManager");
      }),
      deployRelease: vi.fn(async () => ({
        releaseId: "release-1",
        deployment,
      })),
    };
    const onProgress = vi.fn(async () => undefined);
    const manager = new ReleaseManager(runtime);
    const files = {
      "package.json": "{}",
      "tsconfig.json": "{}",
      "src/index.ts": "export default {}",
    };

    await expect(
      manager.deploy({
        spaceInstanceId: "space-instance-1",
        files,
        onProgress,
      }),
    ).resolves.toEqual({
      releaseId: "release-1",
      deployment,
    });

    expect(onProgress).toHaveBeenCalledWith({
      type: "status",
      stage: "publishing",
      message: "正在构建不可变 release 并正式发布…",
    });
    expect(runtime.deployRelease).toHaveBeenCalledWith({
      spaceInstanceId: "space-instance-1",
      files,
      scaling: {
        minReplicas: 0,
        maxReplicas: 16,
        targetConcurrency: 4,
      },
    });
  });

  it("does not call the runtime when progress reporting fails", async () => {
    const progressFailure = new Error("progress unavailable");
    const runtime: AppExecutionRuntime = {
      openCandidate: vi.fn(() => {
        throw new Error("Candidate is not used by ReleaseManager");
      }),
      deployRelease: vi.fn(async () => ({
        releaseId: "release-1",
        deployment: { release: "release-1" },
      })),
    };
    const manager = new ReleaseManager(runtime);

    await expect(
      manager.deploy({
        spaceInstanceId: "space-instance-1",
        files: {
          "package.json": "{}",
          "tsconfig.json": "{}",
          "src/index.ts": "export default {}",
        },
        onProgress: vi.fn(async () => {
          throw progressFailure;
        }),
      }),
    ).rejects.toBe(progressFailure);
    expect(runtime.deployRelease).not.toHaveBeenCalled();
  });
});
