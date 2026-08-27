import { createHash } from "node:crypto";
import type { AgentExecutionHandle } from "../../agent-runtime/contract.js";
import { configuredProvider } from "./config.js";
import { collaborationInstructions } from "./prompt.js";

export const piSessionId = "space-pi";

export function hostPiSessionId(spaceInstanceId: string) {
  const bytes = createHash("sha256")
    .update(`vibechat-space:${spaceInstanceId}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function ensurePiSession(agent: AgentExecutionHandle) {
  const sessions = await agent.listSessions();
  const existing = sessions.find((session) => session.sessionId === piSessionId);
  if (existing && existing.status !== "failed") return;
  if (existing) await agent.deleteSession(piSessionId);

  await agent.openSession({
    sessionId: piSessionId,
    agent: "pi",
    cwd: "/workspace",
    env: piEnvironment(),
    permissionPolicy: "allow_all",
    additionalInstructions: collaborationInstructions(),
  });
}

export async function writePiSettings(agent: AgentExecutionHandle) {
  if (!process.env.AI_MODEL) return;
  const provider = process.env.AI_PROVIDER ?? configuredProvider();
  if (!provider) return;
  const directory = "/home/agentos/.pi/agent";
  await agent.makeDirectory(directory);
  await agent.writeFile(
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
