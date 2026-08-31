import type { ProjectFiles } from "../project-store.js";

export interface AppRuntimeResponse {
  status: number;
  statusText: string;
  body: Uint8Array;
  headers: Record<string, string>;
  rawHeaders?: Array<[string, string]>;
}

export interface AppCandidateFile {
  path: string;
  content: string;
}

export interface AppCandidateHandle {
  makeDirectory(path: string): Promise<void>;
  writeFiles(files: AppCandidateFile[]): Promise<void>;
  start(input: {
    entryPath: string;
    cwd: string;
    env: Record<string, string>;
  }): Promise<{ processId: number }>;
  fetch(
    port: number,
    url: string,
    request?: {
      method?: string;
      headers?: Record<string, string>;
      body?: Uint8Array;
    },
  ): Promise<AppRuntimeResponse>;
  stop(processId: number): Promise<void>;
  readOutput(processId: number): Promise<string>;
}

export interface AppReleaseScaling {
  minReplicas: number;
  maxReplicas: number;
  targetConcurrency: number;
}

export interface AppReleaseInput {
  spaceInstanceId: string;
  files: ProjectFiles;
  scaling: AppReleaseScaling;
}

export interface AppReleaseResult {
  releaseId: string;
  /** Opaque compatibility payload forwarded to existing Runtime events. */
  deployment: Record<string, unknown>;
}

export interface AppExecutionRuntime {
  openCandidate(actorKey: string): AppCandidateHandle;
  deployRelease(input: AppReleaseInput): Promise<AppReleaseResult>;
}

export type AppCandidateFactory = (actorKey: string) => AppCandidateHandle;
export type AppReleaseExecutor = (
  input: AppReleaseInput,
) => Promise<AppReleaseResult>;
