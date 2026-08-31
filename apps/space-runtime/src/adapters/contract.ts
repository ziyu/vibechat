import type { AgentUsage } from "../agent-usage.js";
import type { ProjectFiles } from "../project-store.js";
import type {
  AgentDefinitionSnapshot,
  AgentEventV1,
  AgentSessionRefV1,
  AgentSessionRestoreResultV1,
  AgentSessionSummaryV1,
  AgentTurnInputV1,
  CancelAgentTurnInputV1,
} from "@vibechat/space-agent-contracts";

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
  executionPoolClass?: string;
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

export interface BeginAgentSessionInput {
  definition: AgentDefinitionSnapshot;
  session: AgentSessionRefV1;
  requestedAt: string;
}

export interface SummarizeAgentSessionInput {
  session: AgentSessionRefV1;
  sourceTurnId: string;
  maxSummaryCharacters: number;
  requestedAt: string;
}

export interface RestoreAgentSessionInput {
  definition: AgentDefinitionSnapshot;
  session: AgentSessionRefV1;
  requestedAt: string;
}

export interface AgentProjectPatch {
  patchRef: string;
  sourceHash: `sha256:${string}`;
  filesChanged: string[];
}

/**
 * Runtime-local Project staging port. Source files stay outside the shared
 * wire contracts; an Adapter can only read and replace its current staged
 * snapshot, while the Turn processor remains responsible for validation,
 * Candidate creation, and moving the ready Revision pointer.
 */
export interface AgentProjectWorkspace {
  readonly baseRevisionId: string;
  read(): Promise<ProjectFiles>;
  apply(turnId: string, files: ProjectFiles): Promise<AgentProjectPatch>;
}

export type RunAgentTurnInput = AgentTurnInputV1 & {
  projectWorkspace: AgentProjectWorkspace;
};

/**
 * Provider-neutral S4 lifecycle port. Runtime consumers migrate to this only
 * after the fake contract suite is stable; the legacy adapter remains the S3
 * execution path until Pi is migrated in a later slice.
 */
export interface SpaceAgentLifecycleAdapter {
  readonly adapterKey: string;
  readonly adapterVersion: string;
  beginSession(
    input: BeginAgentSessionInput,
    signal: AbortSignal,
  ): Promise<AgentSessionRefV1>;
  runTurn(
    input: RunAgentTurnInput,
    signal: AbortSignal,
  ): AsyncIterable<AgentEventV1>;
  summarize(
    input: SummarizeAgentSessionInput,
    signal: AbortSignal,
  ): Promise<AgentSessionSummaryV1>;
  cancel(
    input: CancelAgentTurnInputV1,
    signal: AbortSignal,
  ): Promise<void>;
  restore(
    input: RestoreAgentSessionInput,
    signal: AbortSignal,
  ): Promise<AgentSessionRestoreResultV1>;
}

export type CompleteSpaceAgentAdapter = SpaceAgentAdapter & SpaceAgentLifecycleAdapter;
