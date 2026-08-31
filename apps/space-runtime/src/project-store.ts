import {
  getOfficialSpaceTemplateVersion,
  hashSpaceTemplateProjectFiles,
  isSpaceTemplateProjectFilePath,
  spaceTemplateRequiredProjectPaths,
} from "@vibechat/space-templates";
import { loadOfficialSpaceTemplateArtifact } from "@vibechat/space-templates/node";
import { assertAppId } from "./app-id.js";
import {
  createRemoteProjectStoreFromEnv,
  type RemoteProjectStore,
} from "./remote-project-store.js";

export const requiredProjectPaths = spaceTemplateRequiredProjectPaths;

export type ProjectFiles = Record<string, string>;

export interface StoredProject {
  appId: string;
  files: ProjectFiles;
  sourceHash: `sha256:${string}`;
  summary: string;
  updatedAt: string;
  draftId?: string;
  publishedDraftId?: string;
  releaseId?: string;
  template?: {
    id: string;
    versionId: string;
    integrity: string;
    /** Immutable source hash of the Template Version copied at creation time. */
    sourceHash: `sha256:${string}`;
    /** Hash of source, capabilities, compatibility and provenance. */
    manifestHash: `sha256:${string}`;
    projectFormat: "agentos-app-v1";
  };
}

const maximumProjectFiles = 128;
const maximumFileBytes = 256 * 1024;
const maximumProjectBytes = 2 * 1024 * 1024;
let remoteProjectStore: RemoteProjectStore | null = null;

function projectStore() {
  remoteProjectStore ??= createRemoteProjectStoreFromEnv();
  return remoteProjectStore;
}

export function validateFiles(value: unknown): ProjectFiles {
  if (!value || typeof value !== "object") {
    throw new TypeError("model response must contain a files object");
  }

  const source = value as Record<string, unknown>;
  const paths = Object.keys(source).sort();
  if (paths.length > maximumProjectFiles) {
    throw new RangeError(`project exceeds ${maximumProjectFiles} files`);
  }
  const files: ProjectFiles = {};
  let totalBytes = 0;
  for (const path of paths) {
    if (!isSpaceTemplateProjectFilePath(path)) {
      throw new TypeError(`model response contains invalid project path ${path}`);
    }
    const content = source[path];
    if (typeof content !== "string") {
      throw new TypeError(`model response file ${path} must be text`);
    }
    const bytes = Buffer.byteLength(content);
    if (bytes > maximumFileBytes) {
      throw new RangeError(`${path} exceeds ${maximumFileBytes} bytes`);
    }
    totalBytes += bytes;
    if (totalBytes > maximumProjectBytes) {
      throw new RangeError(`project exceeds ${maximumProjectBytes} bytes`);
    }
    files[path] = content;
  }
  for (const path of requiredProjectPaths) {
    if (typeof files[path] !== "string") {
      throw new TypeError(`model response is missing ${path}`);
    }
  }
  return files;
}

export function projectFilePaths(files: ProjectFiles) {
  return Object.keys(validateFiles(files));
}

export async function loadProject(appId: string): Promise<StoredProject | null> {
  assertAppId(appId);
  const project = await projectStore().load(appId);
  if (!project) return null;
  const files = validateFiles(project.files);
  const sourceHash = hashSpaceTemplateProjectFiles(files);
  if (project.sourceHash !== sourceHash) {
    throw new StoredProjectIntegrityError(
      appId,
      project.sourceHash,
      sourceHash,
    );
  }
  return { ...project, files, sourceHash };
}

export async function loadProjectRevision(
  appId: string,
  revisionId: string,
): Promise<StoredProject | null> {
  assertAppId(appId);
  const project = await projectStore().loadRevision(appId, revisionId);
  if (!project) return null;
  const files = validateFiles(project.files);
  const sourceHash = hashSpaceTemplateProjectFiles(files);
  if (project.sourceHash !== sourceHash) {
    throw new StoredProjectIntegrityError(
      appId,
      project.sourceHash,
      sourceHash,
    );
  }
  if (project.draftId !== revisionId) {
    throw new Error(`Stored Space Project Revision ${revisionId} is mismatched`);
  }
  return { ...project, files, sourceHash };
}

export async function saveProject(
  project: Omit<StoredProject, "sourceHash">,
) {
  assertAppId(project.appId);
  const files = validateFiles(project.files);
  const normalized: StoredProject = {
    ...project,
    files,
    sourceHash: hashSpaceTemplateProjectFiles(files),
  };
  return projectStore().save(normalized);
}

export async function initializeProjectFromTemplate(
  appId: string,
  templateId: string,
  templateVersionId: string,
) {
  assertAppId(appId);
  const existing = await loadProject(appId);
  if (existing) return { created: false, project: existing } as const;

  const project = await createProjectFromTemplate(
    appId,
    templateId,
    templateVersionId,
  );
  await saveProject(project);
  return { created: true, project } as const;
}

/**
 * Materializes an immutable Template Version as a new, unsaved Space Project.
 * Callers must validate its Candidate before replacing the current ready Project.
 */
export async function createProjectFromTemplate(
  appId: string,
  templateId: string,
  templateVersionId: string,
) {
  assertAppId(appId);

  const templateVersion = getOfficialSpaceTemplateVersion(
    templateId,
    templateVersionId,
  );
  if (!templateVersion) {
    throw new SpaceTemplateVersionNotFoundError(templateId, templateVersionId);
  }
  const templateArtifact = await loadOfficialSpaceTemplateArtifact(
    templateId,
    templateVersion.id,
  );
  if (!templateArtifact) {
    throw new SpaceTemplateVersionNotFoundError(templateId, templateVersionId);
  }
  const project: StoredProject = {
    appId,
    files: validateFiles(templateArtifact.files),
    sourceHash: templateVersion.sourceHash,
    summary: templateArtifact.summary,
    updatedAt: new Date().toISOString(),
    template: {
      id: templateId,
      versionId: templateVersion.id,
      integrity: templateVersion.integrity,
      sourceHash: templateVersion.sourceHash,
      manifestHash: templateVersion.manifestHash,
      projectFormat: templateVersion.projectFormat,
    },
  };
  return project;
}

export class StoredProjectIntegrityError extends Error {
  constructor(
    appId: string,
    expectedSourceHash: string,
    actualSourceHash: string,
  ) {
    super(
      `Stored Space Project ${appId} failed source integrity validation: expected ${expectedSourceHash}, received ${actualSourceHash}`,
    );
    this.name = "StoredProjectIntegrityError";
  }
}

export class SpaceTemplateVersionNotFoundError extends Error {
  constructor(templateId: string, templateVersionId: string) {
    super(`Unknown Space template version: ${templateId}/${templateVersionId}`);
    this.name = "SpaceTemplateVersionNotFoundError";
  }
}
