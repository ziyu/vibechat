import { networkInterfaces } from "node:os";
import { join, resolve } from "node:path";
import {
  parseSpaceRuntimeSchedulingConfig,
  type SpaceRuntimeSchedulingConfig,
} from "../runtime-config.js";

export interface SpaceRuntimeConfig {
  port: number;
  hostname: string;
  maximumPromptLength: number;
  maximumRepairs: number;
  defaultChatTemplateId: string;
  defaultAgentId: string;
  internalSigningSecret: string;
  scheduling: SpaceRuntimeSchedulingConfig;
  agentOsTemporaryDirectory: string;
  rivetkitStoragePath: string;
  rivetEngineDataDirectory: string;
  configuredRivetEndpoint?: string;
  localRivetEndpoint: string;
}

export function createSpaceRuntimeConfig(
  environment: NodeJS.ProcessEnv = process.env,
): SpaceRuntimeConfig {
  const scheduling = parseSpaceRuntimeSchedulingConfig(environment);
  const rivetkitStoragePath = resolve(
    environment.RIVETKIT_STORAGE_PATH ??
      join(process.cwd(), ".data", "rivetkit-storage"),
  );
  return {
    port: Number(environment.SPACE_RUNTIME_PORT ?? environment.PORT ?? 8007),
    hostname: environment.HOST ?? "0.0.0.0",
    maximumPromptLength: 4_000,
    maximumRepairs: 3,
    defaultChatTemplateId: "space-default",
    defaultAgentId: environment.SPACE_AGENT_DEFAULT_ID?.trim() || "pi",
    internalSigningSecret:
      environment.SPACE_RUNTIME_INTERNAL_TOKEN?.trim() ?? "",
    scheduling,
    agentOsTemporaryDirectory: resolve(
      environment.SPACE_RUNTIME_TMP_DIR ??
        `/tmp/vc-space-runtime-${process.pid}`,
    ),
    rivetkitStoragePath,
    rivetEngineDataDirectory: resolve(
      environment.RIVET_ENGINE_DATABASE_PATH ??
        join(rivetkitStoragePath, "managed-engine", "db"),
    ),
    configuredRivetEndpoint:
      environment.RIVET_ENDPOINT ?? environment.AGENTOS_ENDPOINT,
    localRivetEndpoint: "http://127.0.0.1:6420",
  };
}

export function localUrls(activePort: number) {
  const urls = new Set([`http://localhost:${activePort}`]);
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family !== "IPv4" || address.internal) continue;
      urls.add(`http://${address.address}:${activePort}`);
    }
  }
  return [...urls];
}
