import type { AgentExecutionHandle } from "../../agent-runtime/contract.js";
import { collaborationInstructions } from "../pi/prompt.js";

export const claudeCodeSessionId = "space-claude-code";

export async function ensureClaudeCodeSession(agent: AgentExecutionHandle) {
  const sessions = await agent.listSessions();
  const existing = sessions.find(
    (session) => session.sessionId === claudeCodeSessionId,
  );
  if (existing && existing.status !== "failed") return;
  if (existing) await agent.deleteSession(claudeCodeSessionId);
  await agent.openSession({
    sessionId: claudeCodeSessionId,
    agent: "claude",
    cwd: "/workspace",
    permissionPolicy: "allow_all",
    additionalInstructions: collaborationInstructions().replaceAll(
      "Pi",
      "Claude Code",
    ),
  });
}
