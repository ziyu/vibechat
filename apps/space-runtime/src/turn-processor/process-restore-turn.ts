import type { DevPreviewResult } from "../dev-preview.js";
import type { ProjectFiles, StoredProject } from "../project-store.js";
import type {
  SpaceBuildProgress,
  SpaceEvent,
  SpaceTurnRecovery,
} from "../space-instance-server.js";

export interface RestoreTemplateRef {
  id: string;
  currentVersionId: string;
}

export interface RestoreTurnProcessorDependencies {
  loadProject(spaceInstanceId: string): Promise<StoredProject | null>;
  getDefaultTemplate(): RestoreTemplateRef | null;
  createProjectFromTemplate(input: {
    spaceInstanceId: string;
    templateId: string;
    templateVersionId: string;
  }): Promise<StoredProject>;
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

export class RestoreTurnProcessor {
  readonly #dependencies: RestoreTurnProcessorDependencies;

  constructor(dependencies: RestoreTurnProcessorDependencies) {
    this.#dependencies = dependencies;
  }

  async process(input: {
    spaceInstanceId: string;
    turnId: string;
    recovery: SpaceTurnRecovery;
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
      const current = await this.#dependencies.loadProject(
        input.spaceInstanceId,
      );
      if (!current?.draftId) {
        throw new Error("Space 还没有可恢复的 ready Revision。");
      }
      if (current.draftId !== input.recovery.expectedReadyRevisionId) {
        throw this.#dependencies.createReadyRevisionChangedError(
          input.recovery.expectedReadyRevisionId,
          current.draftId,
        );
      }
      const template = this.#dependencies.getDefaultTemplate();
      if (!template) {
        throw new Error("Default Chat Template is unavailable");
      }

      await relayProgress({
        type: "status",
        stage: "recovering",
        message: "正在从官方 Template 准备 Default Chat App Candidate…",
      });
      const candidate = await this.#dependencies.createProjectFromTemplate({
        spaceInstanceId: input.spaceInstanceId,
        templateId: template.id,
        templateVersionId: template.currentVersionId,
      });
      const preview = await this.#dependencies.preparePreview({
        spaceInstanceId: input.spaceInstanceId,
        files: candidate.files,
        onStatus: (status) =>
          relayProgress({
            type: "status",
            stage: "recovering",
            message: status,
          }),
      });
      const updatedAt = preview.updatedAt;
      await this.#dependencies.saveProject({
        ...candidate,
        updatedAt,
        draftId: preview.version,
        ...(current.publishedDraftId
          ? { publishedDraftId: current.publishedDraftId }
          : {}),
        ...(current.releaseId ? { releaseId: current.releaseId } : {}),
      });
      const message = "已恢复 Default Chat App。";
      await this.#dependencies.complete({
        spaceInstanceId: input.spaceInstanceId,
        turnId: input.turnId,
        message,
        event: {
          type: "draft_ready",
          message,
          appId: input.spaceInstanceId,
          appUrl: `/apps/${encodeURIComponent(input.spaceInstanceId)}/`,
          devUrl: preview.url,
          version: preview.version,
          updatedAt,
          recoveredFromRevisionId: current.draftId,
          recoveryTarget: input.recovery.target,
          publishedReleaseId: current.releaseId ?? null,
        },
      });
      return true;
    } catch (error) {
      this.#dependencies.reportError("Default Chat recovery failed", error);
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
