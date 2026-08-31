import type { AgentUsage } from "../../agent-usage.js";
import type { ProjectFiles } from "../../project-store.js";

export interface PiRunnerResult {
  files: ProjectFiles;
  summary: string;
  usage?: AgentUsage;
}
