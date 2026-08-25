import type { AgentUsage } from "./agent-usage.js";
import type {
  GeneratedRevision,
  GenerationProgress,
  ProjectTurnResult,
} from "./generator.js";
import type { ProjectFiles } from "./project-store.js";

export interface SpaceAgentTurnInput {
  appId: string;
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

export class SpaceAgentRegistry {
  readonly #adapters = new Map<string, SpaceAgentAdapter>();

  constructor(adapters: Iterable<SpaceAgentAdapter>) {
    for (const adapter of adapters) {
      if (!adapter.id.trim()) throw new Error("Agent Adapter id is required");
      if (this.#adapters.has(adapter.id)) {
        throw new Error(`Duplicate Agent Adapter id: ${adapter.id}`);
      }
      this.#adapters.set(adapter.id, adapter);
    }
  }

  get(id: string) {
    return this.#adapters.get(id);
  }

  has(id: string) {
    return this.#adapters.has(id);
  }

  list() {
    return [...this.#adapters.values()].map((adapter) => ({
      id: adapter.id,
      name: adapter.name,
      available: adapter.isAvailable(),
    }));
  }
}

export function createPiAgentAdapter(input: {
  isAvailable: () => boolean;
  runProjectTurn: SpaceAgentAdapter["runProjectTurn"];
  reviseProject: SpaceAgentAdapter["reviseProject"];
}): SpaceAgentAdapter {
  return {
    id: "pi",
    name: "Pi",
    ...input,
  };
}

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
