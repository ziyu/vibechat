import type { DevPreviewResult } from "../dev-preview.js";
import type { ProjectFiles, StoredProject } from "../project-store.js";
import type { ReleaseDeployment } from "../release-manager/release-manager.js";
import type {
  SpaceBuildProgress,
  SpaceEvent,
} from "../space-instance-server.js";

export interface PublishTurnProcessorDependencies {
  loadProject(spaceInstanceId: string): Promise<StoredProject | null>;
  preparePreview(input: {
    spaceInstanceId: string;
    files: ProjectFiles;
    onStatus: (status: string) => void | Promise<void>;
  }): Promise<DevPreviewResult>;
  heartbeat(input: {
    spaceInstanceId: string;
    turnId: string;
    elapsedSeconds: number;
  }): Promise<void>;
  progress(input: {
    spaceInstanceId: string;
    turnId: string;
    event: SpaceBuildProgress;
  }): Promise<void>;
  announce(input: {
    spaceInstanceId: string;
    event: SpaceEvent;
  }): Promise<void>;
  deployRevision(input: {
    spaceInstanceId: string;
    files: ProjectFiles;
    onProgress: (event: SpaceBuildProgress) => Promise<void>;
  }): Promise<ReleaseDeployment>;
  saveProject(project: StoredProject): Promise<unknown>;
  complete(input: {
    spaceInstanceId: string;
    turnId: string;
    message: string;
    event: SpaceEvent;
  }): Promise<void>;
  failTurn(input: {
    spaceInstanceId: string;
    turnId: string;
    error: unknown;
  }): Promise<void>;
  createReadyRevisionChangedError(expected: string, actual: string): Error;
  reportError(message: string, error: unknown): void;
}

export class PublishTurnProcessor {
  readonly #dependencies: PublishTurnProcessorDependencies;

  constructor(dependencies: PublishTurnProcessorDependencies) {
    this.#dependencies = dependencies;
  }

  async process(input: {
    spaceInstanceId: string;
    turnId: string;
    expectedReadyRevisionId: string;
  }): Promise<boolean> {
    const startedAt = Date.now();
    const heartbeat = setInterval(() => {
      void this.#dependencies
        .heartbeat({
          spaceInstanceId: input.spaceInstanceId,
          turnId: input.turnId,
          elapsedSeconds: Math.floor((Date.now() - startedAt) / 1_000),
        })
        .catch(() => undefined);
    }, 2_000);
    const relayProgress = (event: SpaceBuildProgress) =>
      this.#dependencies.progress({
        spaceInstanceId: input.spaceInstanceId,
        turnId: input.turnId,
        event,
      });

    try {
      const project = await this.#dependencies.loadProject(
        input.spaceInstanceId,
      );
      if (!project) {
        throw new Error(
          "Space 还没有可发布的开发版本，请先让 Agent 创建应用。",
        );
      }
      if (
        !project.draftId ||
        project.draftId !== input.expectedReadyRevisionId
      ) {
        throw this.#dependencies.createReadyRevisionChangedError(
          input.expectedReadyRevisionId,
          project.draftId || "missing",
        );
      }

      await relayProgress({
        type: "status",
        stage: "publishing",
        message: "正在确认 Space Dev 版本…",
      });
      const preview = await this.#dependencies.preparePreview({
        spaceInstanceId: input.spaceInstanceId,
        files: project.files,
        onStatus: (status) =>
          relayProgress({
            type: "status",
            stage: "developing",
            message: status,
          }),
      });
      if (preview.version !== input.expectedReadyRevisionId) {
        throw this.#dependencies.createReadyRevisionChangedError(
          input.expectedReadyRevisionId,
          preview.version,
        );
      }

      await this.#dependencies.announce({
        spaceInstanceId: input.spaceInstanceId,
        event: {
          type: "dev_ready",
          appId: input.spaceInstanceId,
          version: preview.version,
          devUrl: preview.url,
          updatedAt: preview.updatedAt,
        },
      });
      const deployment = await this.#dependencies.deployRevision({
        spaceInstanceId: input.spaceInstanceId,
        files: project.files,
        onProgress: relayProgress,
      });
      const updatedAt = new Date().toISOString();
      await this.#dependencies.saveProject({
        ...project,
        updatedAt,
        draftId: preview.version,
        publishedDraftId: preview.version,
        releaseId: deployment.releaseId,
      });
      const message = "当前开发版本已正式发布。";
      await this.#dependencies.complete({
        spaceInstanceId: input.spaceInstanceId,
        turnId: input.turnId,
        message,
        event: {
          type: "deployed",
          message,
          appId: input.spaceInstanceId,
          appUrl: `/apps/${encodeURIComponent(input.spaceInstanceId)}/`,
          updatedAt,
          deployment: deployment.deployment,
        },
      });
      return true;
    } catch (error) {
      this.#dependencies.reportError("Publish failed", error);
      await this.#dependencies.failTurn({
        spaceInstanceId: input.spaceInstanceId,
        turnId: input.turnId,
        error,
      });
      return false;
    } finally {
      clearInterval(heartbeat);
    }
  }
}
