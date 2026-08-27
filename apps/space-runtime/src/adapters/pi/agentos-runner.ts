import { isSpaceTemplateProjectFilePath } from "@vibechat/space-templates";
import type {
  AgentExecutionHandle,
  AgentExecutionRuntime,
  AgentRuntimeEvent,
} from "../../agent-runtime/contract.js";
import { projectFilePaths, validateFiles } from "../../project-store.js";
import type { GenerationProgress, SpaceAgentTurnInput } from "../contract.js";
import { isFileMutation, progressStatus, toolLabel } from "./progress.js";
import { readAgentFiles, writeAgentFiles } from "./project-workspace.js";
import { turnPrompt } from "./prompt.js";
import type { PiRunnerResult } from "./runner-types.js";
import { ensurePiSession, piSessionId, writePiSettings } from "./session.js";

export async function runAgentOsPi(
  input: SpaceAgentTurnInput,
  executionRuntime: AgentExecutionRuntime,
  signal: AbortSignal = new AbortController().signal,
): Promise<PiRunnerResult> {
  signal.throwIfAborted();
  const agent = executionRuntime.open({
    spaceInstanceId: input.spaceInstanceId,
    agentId: "pi",
  });
  await agent.makeDirectory("/workspace/src");
  await writeAgentFiles(agent, input.files);
  await writePiSettings(agent);

  const tools = new Map<string, { name: string; path?: string }>();
  const observedProjectPaths = new Set(projectFilePaths(input.files));
  let progressQueue = Promise.resolve();
  const enqueue = (event: AgentRuntimeEvent) => {
    if (event.sessionId !== piSessionId) return;
    progressQueue = progressQueue.then(() =>
      relaySessionEvent(
        agent,
        event,
        tools,
        observedProjectPaths,
        input.onProgress,
      ),
    );
  };
  const connection = await agent.connect(enqueue);

  try {
    await ensurePiSession(agent);
    const result = await promptWithAbort(
      agent,
      {
        sessionId: piSessionId,
        text: turnPrompt(input),
      },
      signal,
    );
    await progressQueue;

    return {
      files: validateFiles(await readAgentFiles(agent, observedProjectPaths)),
      summary: extractAcpSummary(result.content),
    };
  } finally {
    await connection.dispose();
  }
}

async function promptWithAbort(
  agent: AgentExecutionHandle,
  input: { sessionId: string; text: string },
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  let abort: (() => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    abort = () => {
      void agent.deleteSession(input.sessionId).catch(() => undefined);
      reject(
        signal.reason instanceof Error
          ? signal.reason
          : new Error("Pi AgentOS generation was cancelled"),
      );
    };
    signal.addEventListener("abort", abort, { once: true });
  });
  try {
    return await Promise.race([agent.prompt(input), aborted]);
  } finally {
    if (abort) signal.removeEventListener("abort", abort);
  }
}

async function relaySessionEvent(
  agent: AgentExecutionHandle,
  event: AgentRuntimeEvent,
  tools: Map<string, { name: string; path?: string }>,
  observedProjectPaths: Set<string>,
  onProgress?: (event: GenerationProgress) => void | Promise<void>,
) {
  if (!onProgress) return;
  if (
    event.type === "agent_message_chunk" &&
    event.content.type === "text" &&
    event.content.text
  ) {
    await onProgress({
      type: "agent_delta",
      text: event.content.text,
      streamId: "agentos-message",
    });
    return;
  }
  if (event.type === "agent_thought_chunk") {
    await onProgress({
      type: "thought",
      id: "agentos-thinking",
      label: "Pi 正在分析需求与现有代码",
      status: "in_progress",
    });
    return;
  }
  if (event.type === "tool_call") {
    const toolName = event.title || "tool";
    const path = toolPath(event);
    if (path && isSpaceTemplateProjectFilePath(path)) {
      observedProjectPaths.add(path);
    }
    tools.set(event.toolCallId, { name: toolName, path });
    await onProgress({
      type: "activity",
      label: toolLabel(toolName, path),
      status: progressStatus(event.status),
      toolCallId: event.toolCallId,
      path,
    });
    return;
  }
  if (event.type !== "tool_call_update") return;

  const tool = tools.get(event.toolCallId);
  await onProgress({
    type: "activity",
    label: toolLabel(tool?.name ?? "tool", tool?.path),
    status: progressStatus(event.status),
    toolCallId: event.toolCallId,
    path: tool?.path,
  });
  if (event.status === "completed" && isFileMutation(tool?.name)) {
    await onProgress({
      type: "workspace",
      files: validateFiles(await readAgentFiles(agent, observedProjectPaths)),
      changedPath: tool?.path,
    });
  }
  if (event.status === "completed" || event.status === "failed") {
    tools.delete(event.toolCallId);
  }
}

function toolPath(event: Extract<AgentRuntimeEvent, { type: "tool_call" }>) {
  const location = event.locations?.[0]?.path;
  const rawPath =
    event.rawInput &&
    typeof event.rawInput === "object" &&
    !Array.isArray(event.rawInput) &&
    "path" in event.rawInput &&
    typeof event.rawInput.path === "string"
      ? event.rawInput.path
      : undefined;
  const path = location ?? rawPath;
  return path?.replace(/^\/workspace\/?/, "") || undefined;
}

function extractAcpSummary(content: unknown) {
  if (!Array.isArray(content)) return "Pi 已完成本轮处理。";
  const text = content
    .flatMap((block) => {
      if (
        typeof block === "object" &&
        block !== null &&
        "type" in block &&
        block.type === "text" &&
        "text" in block &&
        typeof block.text === "string"
      ) {
        return [block.text];
      }
      return [];
    })
    .join("\n")
    .trim();
  return text ? text.slice(0, 1_200) : "Pi 已完成本轮处理。";
}
