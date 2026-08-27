import type { AgentUsage } from "../agent-usage.js";
import type { ProjectFiles } from "../project-store.js";

export interface GeneratedRevision {
  files: ProjectFiles;
  summary: string;
  usage?: AgentUsage;
}

export type ProjectTurnResult =
  | { kind: "chat"; message: string; usage?: AgentUsage }
  | ({ kind: "revision" } & GeneratedRevision);

export type GenerationProgress =
  | { type: "agent_delta"; text: string; streamId?: string }
  | {
      type: "thought";
      id: string;
      label: string;
      status: "in_progress" | "completed";
    }
  | {
      type: "activity";
      label: string;
      status: "pending" | "in_progress" | "completed" | "failed";
      toolCallId?: string;
      path?: string;
    }
  | {
      type: "workspace";
      files: ProjectFiles;
      changedPath?: string;
    };

export interface SpaceAgentTurnInput {
  spaceInstanceId: string;
  request: string;
  files: ProjectFiles;
  diagnostics?: string;
  onProgress?: (event: GenerationProgress) => void | Promise<void>;
}

export interface SpaceAgentAdapter {
  readonly id: string;
  readonly name: string;
  isAvailable(): boolean;
  runProjectTurn(input: SpaceAgentTurnInput): Promise<ProjectTurnResult>;
  reviseProject(input: SpaceAgentTurnInput): Promise<GeneratedRevision>;
}
