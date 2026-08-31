export type RuntimeConfigSource =
  | "SPACE_AGENT_MAX_CONCURRENCY"
  | "PI_MAX_CONCURRENCY"
  | "SPACE_TURN_BATCH_WINDOW_MS"
  | "PI_BATCH_WINDOW_MS"
  | "default";

export interface SpaceRuntimeSchedulingConfig {
  maximumConcurrentTurns: number;
  turnBatchWindowMs: number;
  sources: {
    maximumConcurrentTurns: RuntimeConfigSource;
    turnBatchWindowMs: RuntimeConfigSource;
  };
}

type RuntimeEnvironment = Record<string, string | undefined>;

export function parseSpaceRuntimeSchedulingConfig(
  environment: RuntimeEnvironment,
): SpaceRuntimeSchedulingConfig {
  const concurrency = resolveValue(
    environment,
    "SPACE_AGENT_MAX_CONCURRENCY",
    "PI_MAX_CONCURRENCY",
    "2",
  );
  const batchWindow = resolveValue(
    environment,
    "SPACE_TURN_BATCH_WINDOW_MS",
    "PI_BATCH_WINDOW_MS",
    "350",
  );

  return {
    maximumConcurrentTurns: Math.max(
      1,
      Math.min(8, Number.parseInt(concurrency.value, 10) || 2),
    ),
    turnBatchWindowMs: Math.max(
      0,
      Math.min(2_000, Number.parseInt(batchWindow.value, 10) || 0),
    ),
    sources: {
      maximumConcurrentTurns: concurrency.source,
      turnBatchWindowMs: batchWindow.source,
    },
  };
}

function resolveValue(
  environment: RuntimeEnvironment,
  currentName: RuntimeConfigSource,
  legacyName: RuntimeConfigSource,
  defaultValue: string,
) {
  if (environment[currentName] !== undefined) {
    return { value: environment[currentName]!, source: currentName };
  }
  if (environment[legacyName] !== undefined) {
    return { value: environment[legacyName]!, source: legacyName };
  }
  return { value: defaultValue, source: "default" as const };
}
