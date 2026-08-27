import type { AgentUsage } from "../../agent-usage.js";
import type { AgentExecutionRuntime } from "../../agent-runtime/contract.js";
import { AgentOsAgentExecutionRuntime } from "../../agent-runtime/agentos/execution-runtime.js";
import type {
  GeneratedRevision,
  ProjectTurnResult,
  SpaceAgentAdapter,
  SpaceAgentTurnInput,
} from "../contract.js";
import { runAgentOsPi } from "./agentos-runner.js";
import { hasModelCredentials, piMode } from "./config.js";
import { runHostPiProjectTurn } from "./host-runner.js";

const defaultExecutionRuntime = new AgentOsAgentExecutionRuntime();

export async function runProjectTurn(
  input: SpaceAgentTurnInput,
  executionRuntime: AgentExecutionRuntime = defaultExecutionRuntime,
): Promise<ProjectTurnResult> {
  if (!hasModelCredentials()) {
    throw new Error(
      "Pi 没有可用的模型凭据。请配置 ANTHROPIC_API_KEY、OPENAI_API_KEY 或其他 Pi 支持的 provider key。",
    );
  }

  const result =
    piMode() === "host"
      ? await runHostPiProjectTurn(input)
      : await runAgentOsPi(input, executionRuntime);
  return classifyProjectTurn(
    input.files,
    result.files,
    result.summary,
    result.usage,
  );
}

export async function reviseProject(
  input: SpaceAgentTurnInput,
  executionRuntime: AgentExecutionRuntime = defaultExecutionRuntime,
): Promise<GeneratedRevision> {
  const turn = await runProjectTurn(input, executionRuntime);
  if (turn.kind === "revision") return turn;
  throw new Error(
    `Pi 没有根据构建诊断修改项目文件：${turn.message.slice(0, 600)}`,
  );
}

export function createPiAgentAdapter(options: {
  executionRuntime?: AgentExecutionRuntime;
} = {}): SpaceAgentAdapter {
  const executionRuntime = options.executionRuntime ?? defaultExecutionRuntime;
  return {
    id: "pi",
    name: "Pi",
    isAvailable: hasModelCredentials,
    runProjectTurn: (input) => runProjectTurn(input, executionRuntime),
    reviseProject: (input) => reviseProject(input, executionRuntime),
  };
}

function classifyProjectTurn(
  before: SpaceAgentTurnInput["files"],
  after: SpaceAgentTurnInput["files"],
  summary: string,
  usage?: AgentUsage,
): ProjectTurnResult {
  const message = summary.trim() || "Pi 已完成本轮处理。";
  const paths = new Set([...Object.keys(before), ...Object.keys(after)]);
  if ([...paths].some((path) => after[path] !== before[path])) {
    return { kind: "revision", files: after, summary: message, usage };
  }
  return { kind: "chat", message, usage };
}
