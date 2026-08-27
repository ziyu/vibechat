import { describe, expect, it, vi } from "vitest";
import type { StoredProject } from "../../../apps/space-runtime/src/project-store";
import type { ReleaseDeployment } from "../../../apps/space-runtime/src/release-manager/release-manager";
import {
  PublishTurnProcessor,
  type PublishTurnProcessorDependencies,
} from "../../../apps/space-runtime/src/turn-processor/process-publish-turn";

const files = {
  "package.json": "{}",
  "tsconfig.json": "{}",
  "src/index.ts": "export default {}",
};

function storedProject(
  overrides: Partial<StoredProject> = {},
): StoredProject {
  return {
    appId: "space-instance-1",
    files,
    sourceHash: `sha256:${"a".repeat(64)}`,
    summary: "Ready revision",
    updatedAt: "2026-08-26T00:00:00.000Z",
    draftId: "revision-ready",
    publishedDraftId: "revision-previous",
    releaseId: "release-previous",
    template: {
      id: "space-default",
      versionId: "v1",
      integrity: "sha256-template",
      sourceHash: `sha256:${"b".repeat(64)}`,
      manifestHash: `sha256:${"c".repeat(64)}`,
      projectFormat: "agentos-app-v1",
    },
    ...overrides,
  };
}

const deployment = {
  releaseId: "release-current",
  deployment: { release: "release-current" },
} satisfies ReleaseDeployment;

function dependencies(
  overrides: Partial<PublishTurnProcessorDependencies> = {},
): PublishTurnProcessorDependencies {
  return {
    loadProject: vi.fn(async () => storedProject()),
    preparePreview: vi.fn(async () => ({
      version: "revision-ready",
      updatedAt: "2026-08-26T00:01:00.000Z",
      url: "http://space-dev.test/apps/space-instance-1/",
    })),
    heartbeat: vi.fn(async () => undefined),
    progress: vi.fn(async () => undefined),
    announce: vi.fn(async () => undefined),
    deployRevision: vi.fn(async () => deployment),
    saveProject: vi.fn(async () => undefined),
    complete: vi.fn(async () => undefined),
    failTurn: vi.fn(async () => undefined),
    createReadyRevisionChangedError: vi.fn(
      (expected, actual) =>
        new Error(`ready Revision changed from ${expected} to ${actual}`),
    ),
    reportError: vi.fn(),
    ...overrides,
  };
}

const processInput = {
  spaceInstanceId: "space-instance-1",
  turnId: "turn-publish-1",
  expectedReadyRevisionId: "revision-ready",
};

describe("PublishTurnProcessor", () => {
  it("publishes the fixed ready Revision and preserves Project lineage", async () => {
    const project = storedProject();
    const input = dependencies({
      loadProject: vi.fn(async () => project),
      preparePreview: vi.fn(async ({ onStatus }) => {
        await onStatus("正在构建 Dev Preview…");
        return {
          version: "revision-ready",
          updatedAt: "2026-08-26T00:01:00.000Z",
          url: "http://space-dev.test/apps/space-instance-1/",
        };
      }),
    });
    const processor = new PublishTurnProcessor(input);

    await expect(processor.process(processInput)).resolves.toBe(true);

    expect(input.preparePreview).toHaveBeenCalledWith({
      spaceInstanceId: "space-instance-1",
      files,
      onStatus: expect.any(Function),
    });
    expect(input.progress).toHaveBeenNthCalledWith(1, {
      spaceInstanceId: "space-instance-1",
      turnId: "turn-publish-1",
      event: {
        type: "status",
        stage: "publishing",
        message: "正在确认 Space Dev 版本…",
      },
    });
    expect(input.progress).toHaveBeenNthCalledWith(2, {
      spaceInstanceId: "space-instance-1",
      turnId: "turn-publish-1",
      event: {
        type: "status",
        stage: "developing",
        message: "正在构建 Dev Preview…",
      },
    });
    expect(input.announce).toHaveBeenCalledWith({
      spaceInstanceId: "space-instance-1",
      event: {
        type: "dev_ready",
        appId: "space-instance-1",
        version: "revision-ready",
        devUrl: "http://space-dev.test/apps/space-instance-1/",
        updatedAt: "2026-08-26T00:01:00.000Z",
      },
    });
    expect(input.deployRevision).toHaveBeenCalledWith({
      spaceInstanceId: "space-instance-1",
      files,
      onProgress: expect.any(Function),
    });
    expect(
      vi.mocked(input.announce).mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(input.deployRevision).mock.invocationCallOrder[0] ?? 0,
    );

    const savedProject = vi.mocked(input.saveProject).mock.calls[0]?.[0];
    expect(savedProject).toEqual({
      ...project,
      updatedAt: expect.any(String),
      draftId: "revision-ready",
      publishedDraftId: "revision-ready",
      releaseId: "release-current",
    });
    expect(input.complete).toHaveBeenCalledWith({
      spaceInstanceId: "space-instance-1",
      turnId: "turn-publish-1",
      message: "当前开发版本已正式发布。",
      event: {
        type: "deployed",
        message: "当前开发版本已正式发布。",
        appId: "space-instance-1",
        appUrl: "/apps/space-instance-1/",
        updatedAt: savedProject?.updatedAt,
        deployment: deployment.deployment,
      },
    });
    expect(input.failTurn).not.toHaveBeenCalled();
  });

  it("fails when the Space has no Project", async () => {
    const input = dependencies({
      loadProject: vi.fn(async () => null),
    });
    const processor = new PublishTurnProcessor(input);

    await expect(processor.process(processInput)).resolves.toBe(false);

    expect(input.reportError).toHaveBeenCalledWith(
      "Publish failed",
      expect.objectContaining({
        message: "Space 还没有可发布的开发版本，请先让 Agent 创建应用。",
      }),
    );
    expect(input.failTurn).toHaveBeenCalledWith({
      spaceInstanceId: "space-instance-1",
      turnId: "turn-publish-1",
      error: expect.objectContaining({
        message: "Space 还没有可发布的开发版本，请先让 Agent 创建应用。",
      }),
    });
    expect(input.preparePreview).not.toHaveBeenCalled();
    expect(input.deployRevision).not.toHaveBeenCalled();
    expect(input.saveProject).not.toHaveBeenCalled();
    expect(input.complete).not.toHaveBeenCalled();
  });

  it("rejects a request for a stale ready Revision before Preview", async () => {
    const changed = new Error("ready revision changed");
    const input = dependencies({
      loadProject: vi.fn(async () =>
        storedProject({ draftId: "revision-newer" }),
      ),
      createReadyRevisionChangedError: vi.fn(() => changed),
    });
    const processor = new PublishTurnProcessor(input);

    await expect(processor.process(processInput)).resolves.toBe(false);

    expect(input.createReadyRevisionChangedError).toHaveBeenCalledWith(
      "revision-ready",
      "revision-newer",
    );
    expect(input.failTurn).toHaveBeenCalledWith({
      spaceInstanceId: "space-instance-1",
      turnId: "turn-publish-1",
      error: changed,
    });
    expect(input.preparePreview).not.toHaveBeenCalled();
    expect(input.deployRevision).not.toHaveBeenCalled();
  });

  it("rejects a Preview whose content version changed", async () => {
    const changed = new Error("preview revision changed");
    const input = dependencies({
      preparePreview: vi.fn(async () => ({
        version: "revision-different",
        updatedAt: "2026-08-26T00:01:00.000Z",
        url: "http://space-dev.test/apps/space-instance-1/",
      })),
      createReadyRevisionChangedError: vi.fn(() => changed),
    });
    const processor = new PublishTurnProcessor(input);

    await expect(processor.process(processInput)).resolves.toBe(false);

    expect(input.createReadyRevisionChangedError).toHaveBeenCalledWith(
      "revision-ready",
      "revision-different",
    );
    expect(input.announce).not.toHaveBeenCalled();
    expect(input.deployRevision).not.toHaveBeenCalled();
    expect(input.saveProject).not.toHaveBeenCalled();
    expect(input.failTurn).toHaveBeenCalledWith({
      spaceInstanceId: "space-instance-1",
      turnId: "turn-publish-1",
      error: changed,
    });
  });

  it("does not advance published pointers when deployment fails", async () => {
    const failure = new Error("release deployment failed");
    const input = dependencies({
      deployRevision: vi.fn(async () => {
        throw failure;
      }),
    });
    const processor = new PublishTurnProcessor(input);

    await expect(processor.process(processInput)).resolves.toBe(false);

    expect(input.announce).toHaveBeenCalled();
    expect(input.saveProject).not.toHaveBeenCalled();
    expect(input.complete).not.toHaveBeenCalled();
    expect(input.reportError).toHaveBeenCalledWith("Publish failed", failure);
    expect(input.failTurn).toHaveBeenCalledWith({
      spaceInstanceId: "space-instance-1",
      turnId: "turn-publish-1",
      error: failure,
    });
  });

  it("heartbeats while Publish work is active and stops after completion", async () => {
    vi.useFakeTimers();
    try {
      let finishDeployment!: (value: ReleaseDeployment) => void;
      const pendingDeployment = new Promise<ReleaseDeployment>((resolve) => {
        finishDeployment = resolve;
      });
      const input = dependencies({
        deployRevision: vi.fn(() => pendingDeployment),
      });
      const processor = new PublishTurnProcessor(input);

      const processing = processor.process(processInput);
      await vi.advanceTimersByTimeAsync(2_000);

      expect(input.heartbeat).toHaveBeenCalledWith({
        spaceInstanceId: "space-instance-1",
        turnId: "turn-publish-1",
        elapsedSeconds: 2,
      });

      finishDeployment(deployment);
      await processing;
      await vi.advanceTimersByTimeAsync(2_000);
      expect(input.heartbeat).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
