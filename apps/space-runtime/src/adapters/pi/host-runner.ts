import { spawn } from "node:child_process";
import { join } from "node:path";
import type { AgentUsage } from "../../agent-usage.js";
import type { GenerationProgress, SpaceAgentTurnInput } from "../contract.js";
import { isFileMutation, toolLabel } from "./progress.js";
import { readHostFiles, syncHostProjectFiles } from "./project-workspace.js";
import { collaborationInstructions, turnPrompt } from "./prompt.js";
import type { PiRunnerResult } from "./runner-types.js";
import { hostPiSessionId } from "./session.js";

export async function runHostPiProjectTurn(
  input: SpaceAgentTurnInput,
  signal: AbortSignal = new AbortController().signal,
): Promise<PiRunnerResult> {
  signal.throwIfAborted();
  const workspace = join(
    process.cwd(),
    ".data",
    "pi-workspaces",
    input.spaceInstanceId,
  );
  await syncHostProjectFiles(workspace, input.files);
  const result = await runHostPi(
    workspace,
    input.spaceInstanceId,
    turnPrompt(input),
    signal,
    input.onProgress,
  );
  return {
    files: await readHostFiles(workspace),
    summary: result.summary,
    usage: result.usage,
  };
}

function runHostPi(
  workspace: string,
  spaceInstanceId: string,
  prompt: string,
  signal: AbortSignal,
  onProgress?: (event: GenerationProgress) => void | Promise<void>,
) {
  signal.throwIfAborted();
  return new Promise<{ summary: string; usage?: AgentUsage }>(
    (resolve, reject) => {
      const args = [
        "--mode",
        "json",
        "--session-dir",
        join(workspace, ".pi-sessions"),
        "--session-id",
        hostPiSessionId(spaceInstanceId),
        "--no-extensions",
        "--no-skills",
        "--no-prompt-templates",
        "--no-context-files",
        "--approve",
        "--tools",
        "read,edit,write",
        "--append-system-prompt",
        collaborationInstructions(),
        ...(process.env.PI_PROVIDER
          ? ["--provider", process.env.PI_PROVIDER]
          : []),
        ...(process.env.PI_MODEL ? ["--model", process.env.PI_MODEL] : []),
        "--thinking",
        process.env.PI_THINKING ?? "medium",
        prompt,
      ];
      const child = spawn(process.env.PI_BIN ?? "pi", args, {
        cwd: workspace,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });
      const tools = new Map<string, { name: string; path?: string }>();
      let stdoutBuffer = "";
      let stderr = "";
      let summary = "";
      let assistantError = "";
      let usage: AgentUsage | undefined;
      let settled = false;
      let progressQueue = Promise.resolve();
      let agentDeltaTimer: ReturnType<typeof setTimeout> | undefined;
      const pendingAgentDeltas = new Map<string, string>();
      const enqueueProgress = (event: GenerationProgress) => {
        progressQueue = progressQueue.then(() =>
          Promise.resolve(onProgress?.(event)),
        );
      };
      const flushAgentDeltas = () => {
        if (agentDeltaTimer) clearTimeout(agentDeltaTimer);
        agentDeltaTimer = undefined;
        for (const [streamId, text] of pendingAgentDeltas) {
          enqueueProgress({ type: "agent_delta", text, streamId });
        }
        pendingAgentDeltas.clear();
      };
      const queueAgentDelta = (delta: { text: string; streamId: string }) => {
        pendingAgentDeltas.set(
          delta.streamId,
          `${pendingAgentDeltas.get(delta.streamId) ?? ""}${delta.text}`,
        );
        if (!agentDeltaTimer) {
          agentDeltaTimer = setTimeout(flushAgentDeltas, 32);
        }
      };
      const cleanup = () => {
        clearTimeout(timeout);
        signal.removeEventListener("abort", abort);
        if (agentDeltaTimer) clearTimeout(agentDeltaTimer);
      };
      const abort = () => {
        if (settled) return;
        settled = true;
        cleanup();
        child.kill("SIGTERM");
        reject(
          signal.reason instanceof Error
            ? signal.reason
            : new Error("Pi generation was cancelled"),
        );
      };
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        child.kill("SIGTERM");
        reject(new Error("Pi generation timed out after 6 minutes"));
      }, 360_000);
      signal.addEventListener("abort", abort, { once: true });

      const handleLine = (line: string) => {
        if (!line.trim()) return;
        let event: HostPiEvent;
        try {
          event = JSON.parse(line) as HostPiEvent;
        } catch {
          return;
        }
        const delta = hostPiDelta(event);
        if (delta) {
          summary += delta.text;
          queueAgentDelta(delta);
        }
        const thought = hostPiThought(event);
        if (thought) {
          flushAgentDeltas();
          enqueueProgress(thought);
        }
        const isMutation =
          event.type === "tool_execution_end" &&
          isFileMutation(tools.get(event.toolCallId ?? "")?.name);
        const activity = hostPiActivity(event, tools);
        if (activity) {
          flushAgentDeltas();
          progressQueue = progressQueue.then(async () => {
            await onProgress?.(activity);
            if (
              event.type === "tool_execution_end" &&
              !event.isError &&
              isMutation
            ) {
              await onProgress?.({
                type: "workspace",
                files: await readHostFiles(workspace),
                changedPath: activity.path,
              });
            }
          });
        }
        if (
          event.type === "message_end" &&
          event.message?.role === "assistant"
        ) {
          usage = hostPiUsage(event.message.usage) ?? usage;
          if (event.message.stopReason === "error") {
            assistantError =
              event.message.errorMessage || "Pi returned an Agent error";
          }
        }
      };

      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        stdoutBuffer += chunk;
        const lines = stdoutBuffer.split("\n");
        stdoutBuffer = lines.pop() ?? "";
        for (const line of lines) handleLine(line);
      });
      child.stderr.on("data", (chunk: string) => {
        if (stderr.length < 64 * 1024) stderr += chunk;
      });
      child.on("error", (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      });
      child.on("close", (code) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (stdoutBuffer.trim()) handleLine(stdoutBuffer);
        flushAgentDeltas();
        void progressQueue.then(() => {
          if (code !== 0 || assistantError) {
            reject(
              new Error(
                assistantError ||
                  `Pi exited with status ${code}: ${stderr.trim().slice(0, 1_000)}`,
              ),
            );
            return;
          }
          resolve({ summary: summary.trim().slice(-1_200), usage });
        });
      });
    },
  );
}

type HostPiEvent = {
  type?: string;
  assistantMessageEvent?: {
    type?: string;
    delta?: unknown;
    contentIndex?: unknown;
  };
  toolCallId?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  partialResult?: unknown;
  isError?: boolean;
  message?: {
    role?: string;
    stopReason?: string;
    errorMessage?: string;
    usage?: {
      input?: unknown;
      output?: unknown;
      totalTokens?: unknown;
    };
  };
};

function hostPiUsage(
  value: NonNullable<HostPiEvent["message"]>["usage"],
): AgentUsage | undefined {
  if (!value) return undefined;
  const inputTokens = nonnegativeInteger(value.input);
  const outputTokens = nonnegativeInteger(value.output);
  const totalTokens = nonnegativeInteger(value.totalTokens);
  if (
    inputTokens === undefined &&
    outputTokens === undefined &&
    totalTokens === undefined
  ) {
    return undefined;
  }
  return {
    ...(inputTokens === undefined ? {} : { inputTokens }),
    ...(outputTokens === undefined ? {} : { outputTokens }),
    ...(totalTokens === undefined ? {} : { totalTokens }),
  };
}

function nonnegativeInteger(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : undefined;
}

function hostPiDelta(event: HostPiEvent) {
  if (
    event.type === "message_update" &&
    event.assistantMessageEvent?.type === "text_delta" &&
    typeof event.assistantMessageEvent.delta === "string"
  ) {
    const contentIndex = event.assistantMessageEvent.contentIndex;
    return {
      text: event.assistantMessageEvent.delta,
      streamId:
        typeof contentIndex === "number" ? `text-${contentIndex}` : "text",
    };
  }
  return null;
}

function hostPiThought(
  event: HostPiEvent,
): Extract<GenerationProgress, { type: "thought" }> | null {
  if (event.type !== "message_update" || !event.assistantMessageEvent) {
    return null;
  }
  const update = event.assistantMessageEvent;
  const contentIndex =
    typeof update.contentIndex === "number" ? update.contentIndex : 0;
  if (update.type === "thinking_start") {
    return {
      type: "thought",
      id: `thinking-${contentIndex}`,
      label: "Pi 正在梳理需求与实现路径…",
      status: "in_progress",
    };
  }
  if (update.type === "thinking_end") {
    return {
      type: "thought",
      id: `thinking-${contentIndex}`,
      label: "Pi 已整理好下一步",
      status: "completed",
    };
  }
  if (update.type === "toolcall_start") {
    return {
      type: "thought",
      id: `toolcall-${contentIndex}`,
      label: "Pi 正在准备下一步工具操作…",
      status: "in_progress",
    };
  }
  if (update.type === "toolcall_end") {
    return {
      type: "thought",
      id: `toolcall-${contentIndex}`,
      label: "工具操作已准备好",
      status: "completed",
    };
  }
  return null;
}

function hostPiActivity(
  event: HostPiEvent,
  tools: Map<string, { name: string; path?: string }>,
): Extract<GenerationProgress, { type: "activity" }> | null {
  if (!event.toolCallId) return null;
  if (event.type === "tool_execution_start") {
    const name = event.toolName ?? "tool";
    const path =
      typeof event.args?.path === "string"
        ? event.args.path.replace(/^.*?pi-workspaces\/[^/]+\/?/, "")
        : undefined;
    tools.set(event.toolCallId, { name, path });
    return {
      type: "activity",
      toolCallId: event.toolCallId,
      label: toolLabel(name, path),
      status: "in_progress",
      path,
    };
  }
  if (event.type === "tool_execution_update") {
    const existing = tools.get(event.toolCallId);
    const name = existing?.name ?? event.toolName ?? "tool";
    const path =
      existing?.path ??
      (typeof event.args?.path === "string"
        ? event.args.path.replace(/^.*?pi-workspaces\/[^/]+\/?/, "")
        : undefined);
    tools.set(event.toolCallId, { name, path });
    return {
      type: "activity",
      toolCallId: event.toolCallId,
      label: toolLabel(name, path),
      status: "in_progress",
      path,
    };
  }
  if (event.type === "tool_execution_end") {
    const tool = tools.get(event.toolCallId);
    tools.delete(event.toolCallId);
    return {
      type: "activity",
      toolCallId: event.toolCallId,
      label: toolLabel(tool?.name ?? "tool", tool?.path),
      status: event.isError ? "failed" : "completed",
      path: tool?.path,
    };
  }
  return null;
}
