import type { AgentUsage } from "../../agent-usage.js";
import type { SpaceAgentAdapter } from "../contract.js";

export function createFakeAgentAdapter(options: {
  id?: string;
  name?: string;
  usage?: AgentUsage;
} = {}): SpaceAgentAdapter {
  const id = options.id || "fake";
  const name = options.name || "Fake Agent";
  const usage = options.usage || {
    inputTokens: 8,
    outputTokens: 5,
    totalTokens: 13,
  };
  return {
    id,
    name,
    isAvailable: () => true,
    async runProjectTurn(input) {
      await input.onProgress?.({
        type: "agent_delta",
        text: `${name} received: ${input.request}`,
      });
      if (input.request.includes("[fake:failure]")) {
        return {
          kind: "revision",
          files: {
            ...input.files,
            "src/fake-agent-failure.ts": "export const deterministicCandidateFailure = ;\n",
          },
          summary: `${name} created a deterministic failing revision.`,
          usage,
        };
      }
      if (input.request.includes("[fake:revision]")) {
        return {
          kind: "revision",
          files: {
            ...input.files,
            "src/fake-agent-note.ts": `export const note = ${JSON.stringify(input.request)};\n`,
          },
          summary: `${name} created a deterministic revision.`,
          usage,
        };
      }
      return {
        kind: "chat",
        message: `${name} received: ${input.request}`,
        usage,
      };
    },
    async reviseProject(input) {
      return {
        files: {
          ...input.files,
          "src/fake-agent-repair.ts": `export const diagnostics = ${JSON.stringify(input.diagnostics || "")};\n`,
        },
        summary: `${name} created a deterministic repair.`,
        usage,
      };
    },
  };
}
