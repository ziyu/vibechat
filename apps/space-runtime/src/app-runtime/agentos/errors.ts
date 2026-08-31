import { AgentOSAppsError } from "@rivet-dev/agentos-apps";

export function agentOsAppsErrorCode(error: unknown) {
  if (!isAgentOsAppsError(error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

export function isRepairableAgentOsAppsError(error: unknown) {
  const code = agentOsAppsErrorCode(error);
  return (
    code === "agentos_apps_build_failed" ||
    code === "agentos_apps_entrypoint_not_found"
  );
}

function isAgentOsAppsError(error: unknown) {
  return (
    error instanceof AgentOSAppsError ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string" &&
      error.code.startsWith("agentos_apps_"))
  );
}
