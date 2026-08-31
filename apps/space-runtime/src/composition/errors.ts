import {
  agentOsAppsErrorCode,
  isRepairableAgentOsAppsError,
} from "../app-runtime/agentos/errors.js";
import { DevPreviewError } from "../release-manager/dev-preview-manager.js";

export class SpaceReadyRevisionChangedError extends Error {
  readonly code = "space_ready_revision_changed";

  constructor(expected: string, actual: string) {
    super(
      `Space ready Revision changed from ${expected} to ${actual}; refresh and retry recovery.`,
    );
    this.name = "SpaceReadyRevisionChangedError";
  }
}

export function isRepairableRevisionError(error: unknown) {
  return error instanceof DevPreviewError || isRepairableAgentOsAppsError(error);
}

export function revisionDiagnostics(error: unknown) {
  if (error instanceof DevPreviewError) return error.diagnostics;
  return boundedDiagnostics(error);
}

export function spaceErrorCode(error: unknown) {
  if (error instanceof SpaceReadyRevisionChangedError) return error.code;
  if (error instanceof DevPreviewError) return error.code;
  return agentOsAppsErrorCode(error);
}

export function boundedDiagnostics(error: unknown) {
  const details = error as {
    code?: unknown;
    message?: unknown;
    metadata?: unknown;
  };
  return JSON.stringify({
    code: details.code,
    message: details.message ?? String(error),
    metadata: details.metadata,
  }).slice(0, 16 * 1024);
}

export function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 1_000);
  return String(error).slice(0, 1_000);
}

export function boundedLogError(error: unknown) {
  const details = error as {
    name?: unknown;
    message?: unknown;
    code?: unknown;
    statusCode?: unknown;
  };
  return {
    name: details?.name,
    message: errorMessage(error),
    code: details?.code,
    statusCode: details?.statusCode,
  };
}
