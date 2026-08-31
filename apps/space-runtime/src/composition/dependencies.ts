import type { SpaceAgentAdapterRegistry } from "../adapters/registry.js";
import type { DurableSpaceControl } from "../durable-space-control.js";
import type { StoredProject } from "../project-store.js";
import type {
  DevPreviewManager,
  DevPreviewStatus,
} from "../release-manager/dev-preview-manager.js";
import type { SpaceInstanceServer } from "../space-instance-server.js";
import type { SpaceRuntimeConfig } from "./runtime-config.js";

export interface SpaceRuntimeDependencies {
  config: SpaceRuntimeConfig;
  durableSpaceControl: DurableSpaceControl;
  agentAdapters: SpaceAgentAdapterRegistry;
  devPreviews: DevPreviewManager;
  spaces: SpaceInstanceServer;
  bootstrapTemplateProject(
    spaceInstanceId: string,
    templateId: string,
    templateVersionId: string,
  ): Promise<{
    created: boolean;
    project: StoredProject;
    devPreview: DevPreviewStatus;
  }>;
}
