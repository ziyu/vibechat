import { describe, expect, it, vi } from "vitest";
import type { StoredProject } from "../../../apps/space-runtime/src/project-store";
import {
  RestoreTurnProcessor,
  type RestoreTurnProcessorDependencies,
} from "../../../apps/space-runtime/src/turn-processor/process-restore-turn";

const currentFiles = {
  "package.json": "{}",
  "tsconfig.json": "{}",
  "src/index.ts": "export const customized = true",
};
const templateFiles = {
  "package.json": "{}",
  "tsconfig.json": "{}",
  "src/index.ts": "export const defaultChat = true",
};

function currentProject(
  overrides: Partial<StoredProject> = {},
): StoredProject {
  return {
    appId: "space-instance-1",
    files: currentFiles,
    sourceHash: `sha256:${"a".repeat(64)}`,
    summary: "Customized App",
    updatedAt: "2026-08-26T00:00:00.000Z",
    draftId: "revision-customized",
    publishedDraftId: "revision-published",
    releaseId: "release-published",
    ...overrides,
  };
}

function templateProject(): StoredProject {
  return {
    appId: "space-instance-1",
    files: templateFiles,
    sourceHash: `sha256:${"b".repeat(64)}`,
    summary: "Default Chat App",
    updatedAt: "2026-08-26T00:01:00.000Z",
    template: {
      id: "space-default",
      versionId: "0.1.2",
      integrity: "sha256-template",
      sourceHash: `sha256:${"c".repeat(64)}`,
      manifestHash: `sha256:${"d".repeat(64)}`,
      projectFormat: "agentos-app-v1",
    },
  };
}

function dependencies(
  overrides: Partial<RestoreTurnProcessorDependencies> = {},
): RestoreTurnProcessorDependencies {
  return {
    loadProject: vi.fn(async () => currentProject()),
    getDefaultTemplate: vi.fn(() => ({
      id: "space-default",
      currentVersionId: "0.1.2",
    })),
    createProjectFromTemplate: vi.fn(async () => templateProject()),
    preparePreview: vi.fn(async () => ({
      version: "revision-default-chat",
      updatedAt: "2026-08-26T00:02:00.000Z",
      url: "http://space-dev.test/apps/space-instance-1/",
    })),
    heartbeat: vi.fn(async () => undefined),
    progress: vi.fn(async () => undefined),
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
  turnId: "turn-restore-1",
  recovery: {
    target: "default-chat" as const,
    expectedReadyRevisionId: "revision-customized",
  },
};

describe("RestoreTurnProcessor", () => {
  it("restores a Default Chat Candidate while preserving Published Release", async () => {
    const current = currentProject();
    const candidate = templateProject();
    const input = dependencies({
      loadProject: vi.fn(async () => current),
      createProjectFromTemplate: vi.fn(async () => candidate),
      preparePreview: vi.fn(async ({ onStatus }) => {
        await onStatus("正在验证 Default Chat App…");
        return {
          version: "revision-default-chat",
          updatedAt: "2026-08-26T00:02:00.000Z",
          url: "http://space-dev.test/apps/space-instance-1/",
        };
      }),
    });
    const processor = new RestoreTurnProcessor(input);

    await expect(processor.process(processInput)).resolves.toBe(true);

    expect(input.createProjectFromTemplate).toHaveBeenCalledWith({
      spaceInstanceId: "space-instance-1",
      templateId: "space-default",
      templateVersionId: "0.1.2",
    });
    expect(input.progress).toHaveBeenNthCalledWith(1, {
      spaceInstanceId: "space-instance-1",
      turnId: "turn-restore-1",
      event: {
        type: "status",
        stage: "recovering",
        message: "正在从官方 Template 准备 Default Chat App Candidate…",
      },
    });
    expect(input.progress).toHaveBeenNthCalledWith(2, {
      spaceInstanceId: "space-instance-1",
      turnId: "turn-restore-1",
      event: {
        type: "status",
        stage: "recovering",
        message: "正在验证 Default Chat App…",
      },
    });
    expect(input.saveProject).toHaveBeenCalledWith({
      ...candidate,
      updatedAt: "2026-08-26T00:02:00.000Z",
      draftId: "revision-default-chat",
      publishedDraftId: "revision-published",
      releaseId: "release-published",
    });
    expect(input.complete).toHaveBeenCalledWith({
      spaceInstanceId: "space-instance-1",
      turnId: "turn-restore-1",
      message: "已恢复 Default Chat App。",
      event: {
        type: "draft_ready",
        message: "已恢复 Default Chat App。",
        appId: "space-instance-1",
        appUrl: "/apps/space-instance-1/",
        devUrl: "http://space-dev.test/apps/space-instance-1/",
        version: "revision-default-chat",
        updatedAt: "2026-08-26T00:02:00.000Z",
        recoveredFromRevisionId: "revision-customized",
        recoveryTarget: "default-chat",
        publishedReleaseId: "release-published",
      },
    });
    expect(input.failTurn).not.toHaveBeenCalled();
  });

  it("fails when there is no ready Revision to recover", async () => {
    const input = dependencies({
      loadProject: vi.fn(async () => currentProject({ draftId: undefined })),
    });
    const processor = new RestoreTurnProcessor(input);

    await expect(processor.process(processInput)).resolves.toBe(false);

    expect(input.failTurn).toHaveBeenCalledWith({
      spaceInstanceId: "space-instance-1",
      turnId: "turn-restore-1",
      error: expect.objectContaining({
        message: "Space 还没有可恢复的 ready Revision。",
      }),
    });
    expect(input.getDefaultTemplate).not.toHaveBeenCalled();
    expect(input.preparePreview).not.toHaveBeenCalled();
    expect(input.saveProject).not.toHaveBeenCalled();
  });

  it("rejects a stale expected ready Revision before creating a Candidate", async () => {
    const changed = new Error("ready revision changed");
    const input = dependencies({
      loadProject: vi.fn(async () =>
        currentProject({ draftId: "revision-newer" }),
      ),
      createReadyRevisionChangedError: vi.fn(() => changed),
    });
    const processor = new RestoreTurnProcessor(input);

    await expect(processor.process(processInput)).resolves.toBe(false);

    expect(input.createReadyRevisionChangedError).toHaveBeenCalledWith(
      "revision-customized",
      "revision-newer",
    );
    expect(input.createProjectFromTemplate).not.toHaveBeenCalled();
    expect(input.failTurn).toHaveBeenCalledWith({
      spaceInstanceId: "space-instance-1",
      turnId: "turn-restore-1",
      error: changed,
    });
  });

  it("fails closed when the Default Chat Template is unavailable", async () => {
    const input = dependencies({
      getDefaultTemplate: vi.fn(() => null),
    });
    const processor = new RestoreTurnProcessor(input);

    await expect(processor.process(processInput)).resolves.toBe(false);

    expect(input.createProjectFromTemplate).not.toHaveBeenCalled();
    expect(input.saveProject).not.toHaveBeenCalled();
    expect(input.failTurn).toHaveBeenCalledWith({
      spaceInstanceId: "space-instance-1",
      turnId: "turn-restore-1",
      error: expect.objectContaining({
        message: "Default Chat Template is unavailable",
      }),
    });
  });

  it("does not replace the ready Project when Candidate validation fails", async () => {
    const failure = new Error("candidate failed");
    const input = dependencies({
      preparePreview: vi.fn(async () => {
        throw failure;
      }),
    });
    const processor = new RestoreTurnProcessor(input);

    await expect(processor.process(processInput)).resolves.toBe(false);

    expect(input.saveProject).not.toHaveBeenCalled();
    expect(input.complete).not.toHaveBeenCalled();
    expect(input.reportError).toHaveBeenCalledWith(
      "Default Chat recovery failed",
      failure,
    );
    expect(input.failTurn).toHaveBeenCalledWith({
      spaceInstanceId: "space-instance-1",
      turnId: "turn-restore-1",
      error: failure,
    });
  });

  it("heartbeats while Restore work is active and stops after completion", async () => {
    vi.useFakeTimers();
    try {
      let finishPreview!: (value: {
        version: string;
        updatedAt: string;
        url: string;
      }) => void;
      const pendingPreview = new Promise<{
        version: string;
        updatedAt: string;
        url: string;
      }>((resolve) => {
        finishPreview = resolve;
      });
      const input = dependencies({
        preparePreview: vi.fn(() => pendingPreview),
      });
      const processor = new RestoreTurnProcessor(input);

      const processing = processor.process(processInput);
      await vi.advanceTimersByTimeAsync(2_000);

      expect(input.heartbeat).toHaveBeenCalledWith({
        spaceInstanceId: "space-instance-1",
        turnId: "turn-restore-1",
        elapsedSeconds: 2,
      });

      finishPreview({
        version: "revision-default-chat",
        updatedAt: "2026-08-26T00:02:00.000Z",
        url: "http://space-dev.test/apps/space-instance-1/",
      });
      await processing;
      await vi.advanceTimersByTimeAsync(2_000);
      expect(input.heartbeat).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
