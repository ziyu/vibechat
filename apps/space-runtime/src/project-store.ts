import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  getOfficialSpaceTemplate,
  getOfficialSpaceTemplateVersion,
  hashSpaceTemplateProjectFiles,
  isSpaceTemplateProjectFilePath,
  spaceTemplateRequiredProjectPaths,
} from "@vibechat/space-templates";
import { loadOfficialSpaceTemplateArtifact } from "@vibechat/space-templates/node";

export const requiredProjectPaths = spaceTemplateRequiredProjectPaths;

export type ProjectFiles = Record<string, string>;

export interface StoredProject {
  appId: string;
  files: ProjectFiles;
  /** Hash of the current editable Project files. Optional only for legacy JSON migration. */
  sourceHash?: `sha256:${string}`;
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
    sourceHash?: `sha256:${string}`;
    /** Hash of source, capabilities, compatibility and provenance. */
    manifestHash?: `sha256:${string}`;
    projectFormat: "agentos-app-v1";
  };
}

const dataDirectory = join(process.cwd(), ".data", "projects");
const maximumProjectFiles = 128;
const maximumFileBytes = 256 * 1024;
const maximumProjectBytes = 2 * 1024 * 1024;

function projectPath(appId: string) {
  return join(dataDirectory, `${appId}.json`);
}

export function assertAppId(appId: string) {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/.test(appId)) {
    throw new TypeError(
      "appId must contain 1-48 lowercase letters, numbers, or hyphens",
    );
  }
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
  try {
    const contents = await readFile(projectPath(appId), "utf8");
    const project = JSON.parse(contents) as StoredProject;
    const files = validateFiles(project.files);
    const sourceHash = hashSpaceTemplateProjectFiles(files);
    if (project.sourceHash && project.sourceHash !== sourceHash) {
      throw new StoredProjectIntegrityError(
        appId,
        project.sourceHash,
        sourceHash,
      );
    }
    return { ...project, files, sourceHash };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function saveProject(project: StoredProject) {
  assertAppId(project.appId);
  const files = validateFiles(project.files);
  const normalized: StoredProject = {
    ...project,
    files,
    sourceHash: hashSpaceTemplateProjectFiles(files),
  };
  await mkdir(dataDirectory, { recursive: true });
  const path = projectPath(project.appId);
  const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(
    temporaryPath,
    `${JSON.stringify(normalized, null, 2)}\n`,
    "utf8",
  );
  await rename(temporaryPath, path);
  return normalized;
}

export async function initializeProjectFromTemplate(
  appId: string,
  templateId: string,
  templateVersionId: string,
) {
  assertAppId(appId);
  const existing = await loadProject(appId);
  if (existing) {
    const upgraded = await upgradeUnmodifiedTemplateProject(existing);
    return { created: false, project: upgraded } as const;
  }

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
  await saveProject(project);
  return { created: true, project } as const;
}

async function upgradeUnmodifiedTemplateProject(existing: StoredProject) {
  const existingTemplate = existing.template;
  const templateId = existingTemplate?.id;
  if (!templateId) return existing;
  const template = getOfficialSpaceTemplate(templateId);
  const lineage = existingTemplate?.versionId
    ? getOfficialSpaceTemplateVersion(templateId, existingTemplate.versionId)
    : null;
  const current = template && getOfficialSpaceTemplateVersion(
    template.id,
    template.currentVersionId,
  );
  if (!current || !lineage) {
    return existing;
  }

  const lineageSourceHash = existingTemplate.sourceHash ?? lineage.sourceHash;
  const currentProjectSourceHash = hashSpaceTemplateProjectFiles(existing.files);
  const lineageStillMatchesCatalog =
    (!existingTemplate.sourceHash
      || existingTemplate.sourceHash === lineage.sourceHash)
    && (!existingTemplate.manifestHash
      || existingTemplate.manifestHash === lineage.manifestHash)
    && (!existingTemplate.manifestHash
      || existingTemplate.integrity === lineage.integrity);
  const projectIsUnmodified =
    lineageStillMatchesCatalog
    && currentProjectSourceHash === lineageSourceHash;

  // Existing Space Projects are independent Revisions. Only the exact source
  // copied from a known immutable Template Version is eligible for a compatibility
  // upgrade; any source edit, however small, remains untouched.
  if (!projectIsUnmodified) return existing;

  if (existingTemplate.versionId === current.id) {
    if (
      existingTemplate.sourceHash
      && existingTemplate.manifestHash
      && existing.sourceHash
    ) return existing;
    const normalized: StoredProject = {
      ...existing,
      sourceHash: currentProjectSourceHash,
      template: {
        ...existingTemplate,
        sourceHash: lineageSourceHash,
        manifestHash: lineage.manifestHash,
      },
    };
    await saveProject(normalized);
    return normalized;
  }

  const currentArtifact = await loadOfficialSpaceTemplateArtifact(
    template.id,
    current.id,
  );
  if (!currentArtifact) return existing;

  const upgraded: StoredProject = {
    ...existing,
    files: validateFiles(currentArtifact.files),
    sourceHash: current.sourceHash,
    summary: currentArtifact.summary,
    updatedAt: new Date().toISOString(),
    draftId: undefined,
    template: {
      id: template.id,
      versionId: current.id,
      integrity: current.integrity,
      sourceHash: current.sourceHash,
      manifestHash: current.manifestHash,
      projectFormat: current.projectFormat,
    },
  };
  await saveProject(upgraded);
  return upgraded;
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

export function projectDirectory() {
  return dirname(projectPath("placeholder"));
}
