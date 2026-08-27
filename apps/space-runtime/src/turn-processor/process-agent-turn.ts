import {
  addAgentUsage,
  type AgentUsage,
} from "../agent-usage.js";
import type { SpaceAgentAdapter } from "../adapters/contract.js";
import type { DevPreviewResult } from "../dev-preview.js";
import type {
  ProjectFiles,
  StoredProject,
} from "../project-store.js";
import type {
  SpaceBuildProgress,
  SpaceEvent,
} from "../space-instance-server.js";
import type { SpaceTurnReply } from "../turn-callbacks.js";

export interface AgentTurnProcessResult {
  succeeded: boolean;
  usage?: AgentUsage;
  reply?: SpaceTurnReply;
}

export interface AgentTurnProcessorDependencies {
  maximumRepairs: number;
  getAgent(agentId: string): SpaceAgentAdapter | undefined;
  loadProject(spaceInstanceId: string): Promise<StoredProject | null>;
  loadSeed(): Promise<ProjectFiles>;
  saveProject(project: Omit<StoredProject, "sourceHash">): Promise<unknown>;
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
  completeChat(input: {
    spaceInstanceId: string;
    turnId: string;
    message: string;
  }): Promise<void>;
  completeRevision(input: {
    spaceInstanceId: string;
    turnId: string;
    summary: string;
    event: SpaceEvent;
  }): Promise<void>;
  failTurn(input: {
    spaceInstanceId: string;
    turnId: string;
    error: unknown;
  }): Promise<void>;
  isRepairableRevisionError(error: unknown): boolean;
  revisionDiagnostics(error: unknown): string;
  reportError(message: string, error: unknown): void;
}

export class AgentTurnProcessor {
  readonly #dependencies: AgentTurnProcessorDependencies;

  constructor(dependencies: AgentTurnProcessorDependencies) {
    this.#dependencies = dependencies;
  }

  async process(input: {
    spaceInstanceId: string;
    turnId: string;
    message: string;
    agentId: string;
  }): Promise<AgentTurnProcessResult> {
    const agent = this.#dependencies.getAgent(input.agentId);
    if (!agent) throw new Error(`Agent ${input.agentId} is not available`);

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
    let usage: AgentUsage | undefined;

    try {
      const existing = await this.#dependencies.loadProject(
        input.spaceInstanceId,
      );
      const currentFiles =
        existing?.files ?? (await this.#dependencies.loadSeed());
      await relayProgress({
        type: "status",
        stage: "thinking",
        message: existing
          ? `${agent.name} 正在理解消息并查看当前应用…`
          : `${agent.name} 正在理解消息并准备应用工作区…`,
      });

      const turn = await agent.runProjectTurn({
        spaceInstanceId: input.spaceInstanceId,
        request: input.message,
        files: currentFiles,
        onProgress: relayProgress,
      });
      usage = addAgentUsage(usage, turn.usage);
      if (turn.kind === "chat") {
        await this.#dependencies.completeChat({
          spaceInstanceId: input.spaceInstanceId,
          turnId: input.turnId,
          message: turn.message,
        });
        return {
          succeeded: true,
          usage,
          reply: {
            agentId: agent.id,
            agentName: agent.name,
            text: turn.message,
          },
        };
      }
      let revision = { files: turn.files, summary: turn.summary };

      for (
        let attempt = 0;
        attempt <= this.#dependencies.maximumRepairs;
        attempt += 1
      ) {
        await relayProgress({
          type: "status",
          stage: attempt === 0 ? "developing" : "repairing",
          attempt,
          message:
            attempt === 0
              ? "正在准备 Space Dev 实时预览…"
              : `正在根据构建诊断自动修复（${attempt}/${this.#dependencies.maximumRepairs}）…`,
        });

        try {
          const preview = await this.#dependencies.preparePreview({
            spaceInstanceId: input.spaceInstanceId,
            files: revision.files,
            onStatus: (status) =>
              relayProgress({
                type: "status",
                stage: "developing",
                message: status,
              }),
          });
          const updatedAt = preview.updatedAt;
          await this.#dependencies.saveProject({
            appId: input.spaceInstanceId,
            files: revision.files,
            summary: revision.summary,
            updatedAt,
            draftId: preview.version,
            ...(existing?.publishedDraftId
              ? { publishedDraftId: existing.publishedDraftId }
              : {}),
            ...(existing?.releaseId ? { releaseId: existing.releaseId } : {}),
            ...(existing?.template ? { template: existing.template } : {}),
          });

          await this.#dependencies.completeRevision({
            spaceInstanceId: input.spaceInstanceId,
            turnId: input.turnId,
            summary: revision.summary,
            event: {
              type: "draft_ready",
              message: revision.summary,
              appId: input.spaceInstanceId,
              appUrl: `/apps/${encodeURIComponent(input.spaceInstanceId)}/`,
              devUrl: preview.url,
              version: preview.version,
              updatedAt,
              publishedReleaseId: existing?.releaseId ?? null,
            },
          });
          return {
            succeeded: true,
            usage,
            reply: {
              agentId: agent.id,
              agentName: agent.name,
              text: revision.summary,
            },
          };
        } catch (error) {
          if (
            !this.#dependencies.isRepairableRevisionError(error) ||
            attempt === this.#dependencies.maximumRepairs
          ) {
            throw error;
          }
          const diagnostics = this.#dependencies.revisionDiagnostics(error);
          await relayProgress({
            type: "status",
            stage: "repairing",
            attempt: attempt + 1,
            message: `开发预览未通过，已把诊断反馈给 ${agent.name}…`,
          });
          const repair = await agent.reviseProject({
            spaceInstanceId: input.spaceInstanceId,
            request: input.message,
            files: revision.files,
            diagnostics,
            onProgress: relayProgress,
          });
          usage = addAgentUsage(usage, repair.usage);
          revision = repair;
        }
      }
    } catch (error) {
      this.#dependencies.reportError("Generation failed", error);
      await this.#dependencies.failTurn({
        spaceInstanceId: input.spaceInstanceId,
        turnId: input.turnId,
        error,
      });
      return { succeeded: false, usage };
    } finally {
      clearInterval(heartbeat);
    }
    return { succeeded: false, usage };
  }
}
