import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  getOfficialSpaceTemplate,
  getOfficialSpaceTemplateVersion,
} from "./index.js";
import {
  hashSpaceTemplateProjectFiles,
  isSpaceTemplateProjectFilePath,
  type SpaceTemplateProject,
  type SpaceTemplateProjectFiles,
} from "./registry.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function readProjectTree(root: string) {
  const files: SpaceTemplateProjectFiles = {};
  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = join(directory, entry.name);
      const projectPath = relative(root, absolutePath).split("\\").join("/");
      if (!isSpaceTemplateProjectFilePath(projectPath)) {
        throw new TypeError(`Official Space Template contains invalid path ${projectPath}`);
      }
      if (entry.isSymbolicLink()) {
        throw new TypeError(`Official Space Template cannot contain symlink ${projectPath}`);
      }
      if (entry.isDirectory()) {
        await visit(absolutePath);
      } else if (entry.isFile()) {
        files[projectPath] = await readFile(absolutePath, "utf8");
      } else {
        throw new TypeError(`Official Space Template contains unsupported entry ${projectPath}`);
      }
    }
  }
  await visit(root);
  return files;
}

/**
 * Development repository Artifact provider. Production resolves the same
 * artifact ID from the Template Registry/Object Store, never from Git paths.
 */
export async function loadOfficialSpaceTemplateArtifact(
  templateId: string,
  versionId: string,
): Promise<SpaceTemplateProject | null> {
  const template = getOfficialSpaceTemplate(templateId);
  const version = getOfficialSpaceTemplateVersion(templateId, versionId);
  if (!template || !version) return null;
  if (version.id !== template.currentVersionId) {
    throw new SpaceTemplateArtifactUnavailableError(
      templateId,
      version.id,
      version.artifact.id,
    );
  }

  const files = await readProjectTree(
    join(packageRoot, "official", templateId, "app"),
  );
  const sourceHash = hashSpaceTemplateProjectFiles(files);
  if (sourceHash !== version.artifact.sourceHash) {
    throw new SpaceTemplateArtifactIntegrityError(
      version.artifact.id,
      version.artifact.sourceHash,
      sourceHash,
    );
  }
  return Object.freeze({
    summary: template.summary.en,
    files: Object.freeze(files),
  });
}

export class SpaceTemplateArtifactUnavailableError extends Error {
  constructor(templateId: string, versionId: string, artifactId: string) {
    super(
      `Template artifact is not available from the repository provider: ${templateId}/${versionId}/${artifactId}`,
    );
    this.name = "SpaceTemplateArtifactUnavailableError";
  }
}

export class SpaceTemplateArtifactIntegrityError extends Error {
  constructor(artifactId: string, expected: string, received: string) {
    super(
      `Template artifact ${artifactId} failed integrity validation: expected ${expected}, received ${received}`,
    );
    this.name = "SpaceTemplateArtifactIntegrityError";
  }
}
