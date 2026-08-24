import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { isSpaceTemplateProjectFilePath } from "@vibechat/space-templates";
import type { SessionStreamEntry } from "@rivet-dev/agentos";
import { createClient } from "@rivet-dev/agentos/client";
import type { registry } from "./actors.js";
import {
  projectFilePaths,
  requiredProjectPaths,
  type ProjectFiles,
  validateFiles,
} from "./project-store.js";

export interface GeneratedRevision {
  files: ProjectFiles;
  summary: string;
}

export type ProjectTurnResult =
  | { kind: "chat"; message: string }
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

const piSessionId = "space-pi";
type PiMode = "agentos" | "host";
const decoder = new TextDecoder();
const client = createClient<typeof registry>({
  endpoint: process.env.AGENTOS_ENDPOINT ?? "http://127.0.0.1:6420",
});

const providerCredentialNames = [
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_OAUTH_TOKEN",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "OPENROUTER_API_KEY",
  "ZAI_API_KEY",
  "GROQ_API_KEY",
  "CEREBRAS_API_KEY",
  "XAI_API_KEY",
  "MISTRAL_API_KEY",
  "AI_GATEWAY_API_KEY",
] as const;

export function hasModelCredentials() {
  return (
    piMode() === "host" ||
    providerCredentialNames.some((name) => Boolean(process.env[name]))
  );
}

export function configuredProvider() {
  if (piMode() === "host") return localPiProvider();
  const name = providerCredentialNames.find((candidate) =>
    Boolean(process.env[candidate]),
  );
  if (!name) return localPiProvider();
  if (name.startsWith("ANTHROPIC_")) return "anthropic";
  if (name === "OPENAI_API_KEY") return "openai";
  if (name === "GEMINI_API_KEY") return "google";
  if (name === "AI_GATEWAY_API_KEY") return "vercel-ai-gateway";
  return name.toLowerCase().replace(/_api_key$/, "").replaceAll("_", "-");
}

function localPiProvider() {
  try {
    const settings = JSON.parse(
      readFileSync(join(homedir(), ".pi", "agent", "settings.json"), "utf8"),
    ) as { defaultProvider?: unknown };
    return typeof settings.defaultProvider === "string"
      ? settings.defaultProvider
      : "local-config";
  } catch {
    return piMode() === "host" ? "local-config" : null;
  }
}

export function piMode(): PiMode {
  if (process.env.PI_MODE === "agentos" || process.env.PI_MODE === "host") {
    return process.env.PI_MODE;
  }
  return existsSync(join(homedir(), ".pi", "agent", "auth.json"))
    ? "host"
    : "agentos";
}

export async function loadSeed(): Promise<ProjectFiles> {
  return readLocalProjectTree(
    fileURLToPath(new URL("../fixtures/app", import.meta.url)),
  );
}

interface ProjectTurnInput {
  appId: string;
  request: string;
  files: ProjectFiles;
  diagnostics?: string;
  onProgress?: (event: GenerationProgress) => void | Promise<void>;
}

export async function runProjectTurn(
  input: ProjectTurnInput,
): Promise<ProjectTurnResult> {
  if (!hasModelCredentials()) {
    throw new Error(
      "Pi 没有可用的模型凭据。请配置 ANTHROPIC_API_KEY、OPENAI_API_KEY 或其他 Pi 支持的 provider key。",
    );
  }

  if (piMode() === "host") return runWithHostPi(input);

  const agent = client.vm.getOrCreate(`space-${input.appId}`);
  await agent.filesystem.mkdir("/workspace/src", { recursive: true });
  await writeAgentFiles(agent, input.files);
  await writePiSettings(agent);

  const connection = agent.connect();
  await connection.ready;

  const tools = new Map<string, { name: string; path?: string }>();
  const observedProjectPaths = new Set(projectFilePaths(input.files));
  let progressQueue = Promise.resolve();
  const enqueue = (value: unknown) => {
    const event = value as SessionStreamEntry;
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
  const unsubscribe = connection.on("sessionEvent", enqueue);

  try {
    await ensurePiSession(agent);
    const result = await agent.sessions.prompt({
      sessionId: piSessionId,
      content: [{ type: "text", text: turnPrompt(input) }],
    });
    await progressQueue;

    const files = validateFiles(await readAgentFiles(agent, observedProjectPaths));
    const summary = extractAcpSummary(result.message?.content);
    return classifyProjectTurn(input.files, files, summary);
  } finally {
    unsubscribe();
    await connection.dispose();
  }
}

export async function reviseProject(
  input: ProjectTurnInput,
): Promise<GeneratedRevision> {
  const turn = await runProjectTurn(input);
  if (turn.kind === "revision") return turn;
  throw new Error(
    `Pi 没有根据构建诊断修改项目文件：${turn.message.slice(0, 600)}`,
  );
}

async function runWithHostPi(input: ProjectTurnInput) {
  const workspace = join(process.cwd(), ".data", "pi-workspaces", input.appId);
  await mkdir(workspace, { recursive: true });
  const inputPaths = projectFilePaths(input.files);
  const existingFiles = await readLocalProjectFileEntries(workspace);
  await Promise.all(
    Object.keys(existingFiles)
      .filter((path) => !inputPaths.includes(path))
      .map((path) => unlink(join(workspace, path))),
  );
  await Promise.all(
    inputPaths.map(async (path) => {
      await mkdir(dirname(join(workspace, path)), { recursive: true });
      await writeFile(join(workspace, path), input.files[path], "utf8");
    }),
  );

  const summary = await runHostPi(
    workspace,
    input.appId,
    turnPrompt(input),
    input.onProgress,
  );
  const files = await readHostFiles(workspace);
  return classifyProjectTurn(input.files, files, summary);
}

function classifyProjectTurn(
  before: ProjectFiles,
  after: ProjectFiles,
  summary: string,
): ProjectTurnResult {
  const message = summary.trim() || "Pi 已完成本轮处理。";
  const paths = new Set([...Object.keys(before), ...Object.keys(after)]);
  if ([...paths].some((path) => after[path] !== before[path])) {
    return { kind: "revision", files: after, summary: message };
  }
  return { kind: "chat", message };
}

function runHostPi(
  workspace: string,
  appId: string,
  prompt: string,
  onProgress?: (event: GenerationProgress) => void | Promise<void>,
) {
  return new Promise<string>((resolve, reject) => {
    const args = [
      "--mode",
      "json",
      "--session-dir",
      join(workspace, ".pi-sessions"),
      "--session-id",
      `space-${appId}`,
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
    const timeout = setTimeout(() => {
      settled = true;
      if (agentDeltaTimer) clearTimeout(agentDeltaTimer);
      child.kill("SIGTERM");
      reject(new Error("Pi generation timed out after 6 minutes"));
    }, 360_000);

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
      clearTimeout(timeout);
      if (agentDeltaTimer) clearTimeout(agentDeltaTimer);
      if (!settled) reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (settled) return;
      if (stdoutBuffer.trim()) handleLine(stdoutBuffer);
      flushAgentDeltas();
      void progressQueue.then(() => {
        if (code !== 0) {
          reject(
            new Error(
              `Pi exited with status ${code}: ${stderr.trim().slice(0, 1_000)}`,
            ),
          );
          return;
        }
        resolve(summary.trim().slice(-1_200));
      });
    });
  });
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
};

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

async function readHostFiles(workspace: string) {
  return readLocalProjectTree(workspace);
}

async function readLocalProjectTree(root: string) {
  return validateFiles(await readLocalProjectFileEntries(root));
}

async function readLocalProjectFileEntries(root: string) {
  const files: ProjectFiles = {};
  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".pi-sessions") continue;
      const absolutePath = join(directory, entry.name);
      const projectPath = relative(root, absolutePath).split("\\").join("/");
      if (!isSpaceTemplateProjectFilePath(projectPath)) continue;
      if (entry.isDirectory()) {
        await visit(absolutePath);
      } else if (entry.isFile()) {
        files[projectPath] = await readFile(absolutePath, "utf8");
      }
    }
  }
  await visit(root);
  return files;
}

function collaborationInstructions() {
  return [
    "You are Pi, the collaborative product and coding agent inside a VibeChat Space.",
    "First infer whether the user is asking for an application change or is only asking a question, discussing the product, requesting an explanation, or planning.",
    "For questions, discussion, explanations, and planning: answer directly in Chinese and do not edit any file.",
    "For requests that create, change, fix, or remove application behavior or UI: make the requested changes directly with the write or edit tools, then summarize them in Chinese.",
    "Edit only this Space App Project. You may create and split source modules under src/ when that improves ownership and maintainability.",
    `Always preserve these required project files: ${requiredProjectPaths.join(", ")}.`,
    "Keep src/index.ts as a small composition entrypoint. Put runtime setup, document composition, styles, markup, browser behavior, and Chat integration in focused modules instead of concentrating the App in src/index.ts.",
    "The generated application is the full-screen App Surface of a shared space. Its content, atmosphere, layout, and application behavior may be defined freely.",
    "The host owns the immutable Space Kernel and Chat Core capabilities. The App owns every surface below the Kernel, including the default Chat UI; it may change how Chat is presented and invoked, but must keep member chat, mentions, @agent dispatch, timeline operations, and recovery callable through the Space SDK.",
    "For real multiplayer behavior in the browser, import { space } from '/v1/space-app-sdk' inside a module script and await space.ready. Do not invent fake online members and do not use RivetKit actors as the browser space transport.",
    "The Space SDK exposes space.self, space.members, space.on('members', handler), space.updatePresence(object), space.presence, persistent space.state.get/set/delete/on, ephemeral space.emit(name, payload), space.onEvent(name, handler), space.chat.send(text), space.chat.on(handler), read-only space.agent, and space.theme.set(theme). space.self and each member have { id, clientId, name }; space.presence is a record keyed by member id whose values contain the member's presence fields. State may be observed with space.state.on(handler) or space.state.on(key, handler). Presence updates are coalesced by the SDK. Store only compact JSON-compatible data.",
    "Use presence for transient member-local state such as cursor or avatar position, persistent state for shared space data that must survive reconnects, and custom events for momentary interactions. These operations never request Pi, build, or publish. space.chat.send enters the ordinary Space Kernel conversation, where Pi may reply and independently decide whether code needs to change.",
    "The SDK is the only allowed App Surface command bridge. It does not expose source, credentials, build, or publishing operations. Never send custom parent.postMessage commands yourself.",
    "The only allowed customization of the host Chat Surface is appearance. Call space.theme.set(theme) with color keys text, muted, accent, surface, surfaceStrong, border, own, peer, agent and an optional radius from 0px to 28px.",
    "When the user asks to change the background, atmosphere, scenery, or space itself, change the generated app's actual full-viewport html/body App Surface. Never treat space:theme as the background implementation; it only coordinates the overlaid Chat Surface.",
    "Make requested visual changes clearly perceptible instead of using near-identical colors or effects too subtle to notice, while preserving readability and the user's requested mood.",
    "For visual changes, keep that space:theme message aligned with the app palette so the fixed chat remains readable over the App Surface.",
    "The project is deployed by agentOS Apps. It must compile under strict TypeScript, call registry.start(), and default-export a Web fetch handler.",
    "Code changes become a Space Dev draft by default. Do not claim that a release was published; the host publishes only after an explicit user publish action.",
    "Keep package.json main as dist/index.js with a tsc build script, and keep tsconfig outDir as dist so agentOS Apps can infer the built entrypoint.",
    "Use only declared dependencies. Keep browser assets inline unless the host provides them. '/v1/space-app-sdk' is the only intentional absolute host URL.",
    "Do not install packages or start servers. The host prepares the isolated Space Dev preview after you finish and runs the immutable release build only when publishing.",
    "Do not inspect node_modules, package-manager caches, Pi documentation, or any path outside the current workspace. Preserve the RivetKit actor and registry scaffold in its existing runtime module for build compatibility, but use the Space SDK for browser multiplayer state in both Space Dev and published spaces.",
    "For UI-only requests, inspect the relevant modules once and implement immediately. Change the smallest coherent set of modules and keep their boundaries clear.",
    "Build a polished and complete application. Do not leave TODOs or placeholder copy.",
    "When practical, write each changed file completely so the live workspace preview stays coherent.",
  ].join("\n");
}

function turnPrompt(input: {
  appId: string;
  request: string;
  diagnostics?: string;
}) {
  return [
    collaborationInstructions(),
    `Respond to this message in the ongoing space for application ${input.appId}:`,
    input.request,
    input.diagnostics
      ? `This is a required code-repair turn. The previous isolated build failed. Edit the project and fix every relevant issue in these diagnostics:\n${input.diagnostics}`
      : "",
    input.diagnostics
      ? "Inspect the existing files, edit them now, and finish with a short Chinese summary of what changed."
      : "If this message does not require an application change, answer it without editing files. If it does require a change, inspect the existing files, edit them now, and finish with a short Chinese summary.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function ensurePiSession(
  agent: ReturnType<typeof client.vm.getOrCreate>,
) {
  const page = await agent.sessions.list({ limit: 100 });
  const existing = page.sessions.find(
    (session) => session.sessionId === piSessionId,
  );
  if (existing && existing.state.status !== "failed") return;
  if (existing) await agent.sessions.delete({ sessionId: piSessionId });

  await agent.sessions.open({
    sessionId: piSessionId,
    agent: "pi",
    cwd: "/workspace",
    env: piEnvironment(),
    permissionPolicy: "allow_all",
    additionalInstructions: collaborationInstructions(),
  });
}

function piEnvironment() {
  return Object.fromEntries(
    [
      [
        "ANTHROPIC_API_KEY",
        process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_AUTH_TOKEN,
      ],
      ["ANTHROPIC_OAUTH_TOKEN", process.env.ANTHROPIC_OAUTH_TOKEN],
      ["ANTHROPIC_BASE_URL", process.env.ANTHROPIC_BASE_URL],
      ["OPENAI_API_KEY", process.env.OPENAI_API_KEY],
      ["GEMINI_API_KEY", process.env.GEMINI_API_KEY],
      ["OPENROUTER_API_KEY", process.env.OPENROUTER_API_KEY],
      ["ZAI_API_KEY", process.env.ZAI_API_KEY],
      ["GROQ_API_KEY", process.env.GROQ_API_KEY],
      ["CEREBRAS_API_KEY", process.env.CEREBRAS_API_KEY],
      ["XAI_API_KEY", process.env.XAI_API_KEY],
      ["MISTRAL_API_KEY", process.env.MISTRAL_API_KEY],
      ["AI_GATEWAY_API_KEY", process.env.AI_GATEWAY_API_KEY],
    ].filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

async function writePiSettings(
  agent: ReturnType<typeof client.vm.getOrCreate>,
) {
  if (!process.env.AI_MODEL) return;
  const provider = process.env.AI_PROVIDER ?? configuredProvider();
  if (!provider) return;
  const directory = "/home/agentos/.pi/agent";
  await agent.filesystem.mkdir(directory, { recursive: true });
  await agent.filesystem.writeFile(
    `${directory}/settings.json`,
    `${JSON.stringify(
      {
        defaultProvider: provider,
        defaultModel: process.env.AI_MODEL,
        defaultThinkingLevel: process.env.PI_THINKING ?? "medium",
      },
      null,
      2,
    )}\n`,
  );
}

async function relaySessionEvent(
  agent: ReturnType<typeof client.vm.getOrCreate>,
  event: SessionStreamEntry,
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

function toolPath(event: Extract<SessionStreamEntry, { type: "tool_call" }>) {
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

function toolLabel(name: string, path?: string) {
  const normalized = name.toLowerCase();
  if (normalized === "read") return path ? `读取 ${path}` : "读取项目文件";
  if (normalized === "write") return path ? `写入 ${path}` : "写入项目文件";
  if (normalized === "edit") return path ? `编辑 ${path}` : "编辑项目文件";
  if (normalized === "bash") return "检查项目结构";
  return `运行 ${name}`;
}

function isFileMutation(name?: string) {
  const normalized = name?.toLowerCase();
  return normalized === "write" || normalized === "edit";
}

function progressStatus(
  status: unknown,
): "pending" | "in_progress" | "completed" | "failed";
function progressStatus(status: unknown) {
  if (
    status === "in_progress" ||
    status === "completed" ||
    status === "failed"
  ) {
    return status;
  }
  return "pending";
}

async function writeAgentFiles(
  agent: ReturnType<typeof client.vm.getOrCreate>,
  files: ProjectFiles,
) {
  for (const path of projectFilePaths(files)) {
    const directory = dirname(`/workspace/${path}`);
    await agent.filesystem.mkdir(directory, { recursive: true });
    await agent.filesystem.writeFile(`/workspace/${path}`, files[path]);
  }
}

async function readAgentFiles(
  agent: ReturnType<typeof client.vm.getOrCreate>,
  paths: Iterable<string>,
) {
  const output: ProjectFiles = {};
  for (const path of [...paths].sort()) {
    output[path] = decoder.decode(
      await agent.filesystem.readFile(`/workspace/${path}`),
    );
  }
  return output;
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
