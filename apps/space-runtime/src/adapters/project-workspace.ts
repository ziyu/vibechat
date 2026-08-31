import { hashSpaceTemplateProjectFiles } from "@vibechat/space-templates";
import { validateFiles, type ProjectFiles } from "../project-store.js";
import type {
  AgentProjectWorkspace,
} from "./contract.js";

export function createAgentProjectWorkspace(
  baseRevisionId: string,
  initialFiles: ProjectFiles,
): AgentProjectWorkspace & { snapshot(): ProjectFiles } {
  let files = validateFiles(initialFiles);
  return {
    baseRevisionId,
    async read() {
      return { ...files };
    },
    async apply(turnId, nextFiles) {
      const normalized = validateFiles(nextFiles);
      const paths = new Set([...Object.keys(files), ...Object.keys(normalized)]);
      const filesChanged = [...paths]
        .filter((path) => files[path] !== normalized[path])
        .sort();
      files = normalized;
      const sourceHash = hashSpaceTemplateProjectFiles(files);
      return {
        patchRef: `runtime-project-patch:${turnId}:${sourceHash}`,
        sourceHash,
        filesChanged,
      };
    },
    snapshot() {
      return { ...files };
    },
  };
}
