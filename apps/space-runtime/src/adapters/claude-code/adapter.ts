import type { AgentExecutionRuntime } from "../../agent-runtime/contract.js";
import { AgentOsAgentExecutionRuntime } from "../../agent-runtime/agentos/execution-runtime.js";
import type {
  CompleteSpaceAgentAdapter,
  ProjectTurnResult,
  RunAgentTurnInput,
  SpaceAgentTurnInput,
} from "../contract.js";
import {
  classifyProjectTurn,
  createLifecycleAgentAdapter,
} from "../pi/adapter.js";
import { runAgentOsAcpProjectTurn } from "../pi/agentos-runner.js";
import { claudeCodeTurnPrompt } from "./prompt.js";
import {
  claudeCodeSessionId,
  ensureClaudeCodeSession,
} from "./session.js";

const defaultExecutionRuntime = new AgentOsAgentExecutionRuntime();

export function hasClaudeCodeCredentials(
  environment: NodeJS.ProcessEnv = process.env,
) {
  return Boolean(
    environment.ANTHROPIC_API_KEY?.trim()
    || environment.ANTHROPIC_AUTH_TOKEN?.trim()
    || environment.ANTHROPIC_OAUTH_TOKEN?.trim(),
  );
}

export async function runClaudeCodeProjectTurn(
  input: SpaceAgentTurnInput,
  executionRuntime: AgentExecutionRuntime = defaultExecutionRuntime,
  signal: AbortSignal = new AbortController().signal,
): Promise<ProjectTurnResult> {
  signal.throwIfAborted();
  if (!hasClaudeCodeCredentials()) {
    throw new Error(
      "Claude Code requires a managed Anthropic credential in the Agent execution pool.",
    );
  }
  const result = await runAgentOsAcpProjectTurn(
    input,
    executionRuntime,
    signal,
    {
      agentId: "claude",
      agentName: "Claude Code",
      sessionId: claudeCodeSessionId,
      ensureSession: ensureClaudeCodeSession,
      prompt: claudeCodeTurnPrompt,
    },
  );
  return classifyProjectTurn(
    input.files,
    result.files,
    result.summary,
    result.usage,
    "Claude Code 已完成本轮处理。",
  );
}

export function createClaudeCodeAgentAdapter(options: {
  executionRuntime?: AgentExecutionRuntime;
  projectTurnRunner?: (
    input: SpaceAgentTurnInput,
    signal: AbortSignal,
  ) => Promise<ProjectTurnResult>;
  isAvailable?: () => boolean;
  restoreMode?: "restored" | "rebuild_required";
  resolveExecutionPoolClass?: (
    definition: RunAgentTurnInput["definition"],
  ) => string | undefined;
} = {}): CompleteSpaceAgentAdapter {
  const executionRuntime = options.executionRuntime ?? defaultExecutionRuntime;
  return createLifecycleAgentAdapter({
    identity: {
      id: "claude",
      name: "Claude Code",
      adapterKey: "claude-code",
      adapterVersion: "0.2.7",
      providerSessionPrefix: "claude-code-session",
      defaultCompletionMessage: "Claude Code 已完成本轮处理。",
    },
    projectTurnRunner: options.projectTurnRunner
      ?? ((input, signal) =>
        runClaudeCodeProjectTurn(input, executionRuntime, signal)),
    isAvailable: options.isAvailable ?? hasClaudeCodeCredentials,
    restoreMode: options.restoreMode,
    resolveExecutionPoolClass: options.resolveExecutionPoolClass,
  });
}
