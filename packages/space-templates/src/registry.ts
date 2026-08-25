import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

/** Files every deployable Space App Project must provide. */
export const spaceTemplateRequiredProjectPaths = [
  "package.json",
  "tsconfig.json",
  "src/index.ts",
] as const;

/**
 * A complete, portable App Project tree. Paths are relative POSIX paths;
 * source modules and assets are not restricted to a fixed three-file list.
 */
export type SpaceTemplateProjectFiles = Record<string, string>;

const forbiddenProjectSegments = new Set([
  ".git",
  ".data",
  ".pi-sessions",
  ".space-dev",
  "dist",
  "node_modules",
]);

export function isSpaceTemplateProjectFilePath(path: string) {
  if (
    path.length === 0
    || path.length > 240
    || path.startsWith("/")
    || path.endsWith("/")
    || path.includes("\\")
    || path.includes("\0")
  ) return false;
  const segments = path.split("/");
  return segments.every(
    (segment) =>
      segment.length > 0
      && !segment.startsWith(".")
      && segment !== "."
      && segment !== ".."
      && !forbiddenProjectSegments.has(segment),
  );
}

export function sortedSpaceTemplateProjectPaths(
  files: SpaceTemplateProjectFiles,
) {
  const paths = Object.keys(files);
  for (const required of spaceTemplateRequiredProjectPaths) {
    if (typeof files[required] !== "string") {
      throw new TypeError(`Space App Project is missing ${required}`);
    }
  }
  for (const path of paths) {
    if (!isSpaceTemplateProjectFilePath(path)) {
      throw new TypeError(`Space App Project contains invalid path ${path}`);
    }
    if (typeof files[path] !== "string") {
      throw new TypeError(`Space App Project file ${path} must be text`);
    }
  }
  const required = new Set<string>(spaceTemplateRequiredProjectPaths);
  return [
    ...spaceTemplateRequiredProjectPaths,
    ...paths.filter((path) => !required.has(path)).sort(),
  ];
}

export interface SpaceTemplateProject {
  summary: string;
  files: SpaceTemplateProjectFiles;
}

export type SpaceTemplateCategory = "daily" | "focus" | "play" | "ritual";
export type SpaceTemplatePublisherVerification =
  | "official"
  | "verified"
  | "unverified";

export interface SpaceTemplatePublisher {
  id: string;
  displayName: string;
  verification: SpaceTemplatePublisherVerification;
}

export interface SpaceTemplateCapabilities {
  permissions: readonly string[];
  networkDomains: readonly string[];
}

export interface SpaceTemplateCompatibility {
  spaceAppSdk: "v1";
  runtime: "agentos-apps-0.2";
}

/** Public, storage-neutral pointer resolved by the Template Artifact Registry. */
export interface SpaceTemplateArtifactRef {
  schemaVersion: "vibechat.space-template-artifact/v1";
  id: string;
  format: "agentos-app-v1";
  sourceHash: `sha256:${string}`;
}

/** Repository and App publication use one provenance envelope. */
export interface SpaceTemplateProvenance {
  origin: "repository" | "app";
  publisherId: string;
  sourcePath?: string;
  sourceRevision?: string;
  sourceSpaceRevisionId?: string;
  buildId?: string;
}

export interface SpaceTemplateVersionManifest {
  schemaVersion: "vibechat.space-template-version/v1";
  id: string;
  semanticVersion: string;
  projectFormat: "agentos-app-v1";
  compatibility: SpaceTemplateCompatibility;
  capabilities: SpaceTemplateCapabilities;
  provenance: SpaceTemplateProvenance;
}

export interface SpaceTemplateVersion extends SpaceTemplateVersionManifest {
  integrity: string;
  sourceHash: `sha256:${string}`;
  manifestHash: `sha256:${string}`;
  artifact: SpaceTemplateArtifactRef;
}

export interface SpaceTemplateManifest {
  schemaVersion: "vibechat.space-template/v1";
  id: string;
  slug: string;
  publisher: SpaceTemplatePublisher;
  currentVersionId: string;
  category: SpaceTemplateCategory;
  name: { en: string; "zh-CN": string };
  summary: { en: string; "zh-CN": string };
  author: string;
  icon: string;
  accent: string;
  canvas: string;
}

/** The market and Runtime use this shape for both official and user Templates. */
export interface SpaceTemplate extends SpaceTemplateManifest {
  versions: readonly SpaceTemplateVersion[];
}

/** Public Market snapshot. Official and user publications are indistinguishable by shape. */
export interface SpaceTemplateMarketEntry {
  schemaVersion: "vibechat.space-template-market-entry/v1";
  id: string;
  versionId: string;
  semanticVersion: string;
  integrity: string;
  sourceHash: `sha256:${string}`;
  manifestHash: `sha256:${string}`;
  artifact: SpaceTemplateArtifactRef;
  projectFormat: "agentos-app-v1";
  compatibility: SpaceTemplateCompatibility;
  provenance: SpaceTemplateProvenance;
  publisher: SpaceTemplatePublisher;
  category: SpaceTemplateCategory;
  name: { en: string; "zh-CN": string };
  summary: { en: string; "zh-CN": string };
  author: string;
  icon: string;
  accent: string;
  canvas: string;
  permissions: string[];
  networkDomains: string[];
}

export interface SpaceTemplateVersionLock {
  schemaVersion: "vibechat.space-template-version-lock/v1";
  sourceHash: `sha256:${string}`;
  manifestHash: `sha256:${string}`;
}

export interface ParsedSpaceTemplateSemanticVersion {
  major: number;
  minor: number;
  patch: number;
}

const canonicalSemanticVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** Template releases intentionally support only canonical major.minor.patch SemVer. */
export function parseSpaceTemplateSemanticVersion(
  value: string,
): ParsedSpaceTemplateSemanticVersion {
  const match = canonicalSemanticVersionPattern.exec(value);
  if (!match) {
    throw new Error(
      `Space Template semanticVersion ${value} must use canonical major.minor.patch SemVer`,
    );
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function compareParsedSemanticVersions(
  left: ParsedSpaceTemplateSemanticVersion,
  right: ParsedSpaceTemplateSemanticVersion,
) {
  return left.major - right.major
    || left.minor - right.minor
    || left.patch - right.patch;
}

function isAdjacentSemanticVersion(
  previous: ParsedSpaceTemplateSemanticVersion,
  next: ParsedSpaceTemplateSemanticVersion,
) {
  return (
    next.major === previous.major
    && next.minor === previous.minor
    && next.patch === previous.patch + 1
  ) || (
    next.major === previous.major
    && next.minor === previous.minor + 1
    && next.patch === 0
  ) || (
    next.major === previous.major + 1
    && next.minor === 0
    && next.patch === 0
  );
}

function versionPayloadFingerprint(version: SpaceTemplateVersion) {
  return JSON.stringify({
    sourceHash: version.sourceHash,
    projectFormat: version.projectFormat,
    compatibility: version.compatibility,
    capabilities: {
      permissions: [...version.capabilities.permissions].sort(),
      networkDomains: [...version.capabilities.networkDomains].sort(),
    },
  });
}

/** Shared market gate for repository-authored and App-authored version histories. */
export function assertSpaceTemplateVersionSequence(
  templateId: string,
  versions: readonly SpaceTemplateVersion[],
  currentVersionId: string,
) {
  if (versions.length === 0) {
    throw new Error(`Space Template ${templateId} has no versions`);
  }

  const seenIds = new Set<string>();
  const seenSemanticVersions = new Set<string>();
  const parsedVersions = versions.map((version) => {
    if (seenIds.has(version.id)) {
      throw new Error(`Space Template ${templateId} repeats version id ${version.id}`);
    }
    if (seenSemanticVersions.has(version.semanticVersion)) {
      throw new Error(
        `Space Template ${templateId} repeats semanticVersion ${version.semanticVersion}`,
      );
    }
    seenIds.add(version.id);
    seenSemanticVersions.add(version.semanticVersion);
    return parseSpaceTemplateSemanticVersion(version.semanticVersion);
  });

  if (versions[0].semanticVersion !== "0.1.0") {
    throw new Error(`Space Template ${templateId} must start at 0.1.0`);
  }

  for (let index = 1; index < versions.length; index += 1) {
    const previous = versions[index - 1];
    const version = versions[index];
    const previousParsed = parsedVersions[index - 1];
    const parsed = parsedVersions[index];
    if (compareParsedSemanticVersions(previousParsed, parsed) >= 0) {
      throw new Error(
        `Space Template ${templateId} versions must be strictly ordered`,
      );
    }
    if (!isAdjacentSemanticVersion(previousParsed, parsed)) {
      throw new Error(
        `Space Template ${templateId} cannot skip from ${previous.semanticVersion} to ${version.semanticVersion}`,
      );
    }
    if (versionPayloadFingerprint(previous) === versionPayloadFingerprint(version)) {
      throw new Error(
        `Space Template ${templateId} ${version.semanticVersion} has no immutable payload change`,
      );
    }
  }

  const latest = versions[versions.length - 1];
  if (latest.id !== currentVersionId) {
    throw new Error(
      `Space Template ${templateId} currentVersionId must reference latest version ${latest.id}`,
    );
  }
}

export function canonicalizeSpaceTemplateProjectFiles(
  files: SpaceTemplateProjectFiles,
) {
  return sortedSpaceTemplateProjectPaths(files)
    .map((path) => `${path.length}:${path}:${files[path].length}:${files[path]}`)
    .join("");
}

export function hashSpaceTemplateProjectFiles(
  files: SpaceTemplateProjectFiles,
): `sha256:${string}` {
  const canonical = canonicalizeSpaceTemplateProjectFiles(files);
  return `sha256:${bytesToHex(sha256(utf8ToBytes(canonical)))}`;
}

export function hashSpaceTemplateProject(
  project: SpaceTemplateProject,
): `sha256:${string}` {
  return hashSpaceTemplateProjectFiles(project.files);
}

export interface CreateSpaceTemplateVersionInput {
  templateId: string;
  manifest: SpaceTemplateVersionManifest;
  project: SpaceTemplateProject;
  lock?: SpaceTemplateVersionLock | null;
}

export interface CreateSpaceTemplateVersionFromReleaseInput {
  templateId: string;
  manifest: SpaceTemplateVersionManifest;
  artifact: SpaceTemplateArtifactRef;
  lock: SpaceTemplateVersionLock;
}

function validateSpaceTemplateVersionManifest(
  templateId: string,
  manifest: SpaceTemplateVersionManifest,
) {
  parseSpaceTemplateSemanticVersion(manifest.semanticVersion);
  if (manifest.provenance.publisherId.trim() === "") {
    throw new Error(`Space Template ${templateId} has no publisher provenance`);
  }
  if (
    manifest.provenance.origin === "repository"
    && !manifest.provenance.sourcePath
  ) {
    throw new Error(`Repository Template ${templateId} has no sourcePath`);
  }
  if (
    manifest.provenance.origin === "app"
    && !manifest.provenance.sourceSpaceRevisionId
  ) {
    throw new Error(`App Template ${templateId} has no sourceSpaceRevisionId`);
  }
}

function prepareSpaceTemplateVersion(
  templateId: string,
  manifest: SpaceTemplateVersionManifest,
  artifactInput: SpaceTemplateArtifactRef,
) {
  validateSpaceTemplateVersionManifest(templateId, manifest);
  if (
    artifactInput.schemaVersion !== "vibechat.space-template-artifact/v1"
    || artifactInput.format !== manifest.projectFormat
    || artifactInput.id !== `tpla-${artifactInput.sourceHash.slice("sha256:".length)}`
    || !/^sha256:[a-f0-9]{64}$/.test(artifactInput.sourceHash)
  ) {
    throw new Error(
      `Space Template ${templateId}/${manifest.id} has an invalid artifact reference`,
    );
  }
  const compatibility = Object.freeze({ ...manifest.compatibility });
  const capabilities = Object.freeze({
    permissions: Object.freeze([...manifest.capabilities.permissions]),
    networkDomains: Object.freeze([...manifest.capabilities.networkDomains]),
  });
  const provenance = Object.freeze({ ...manifest.provenance });
  const artifact = Object.freeze({ ...artifactInput });
  const manifestHash = `sha256:${bytesToHex(
    sha256(
      utf8ToBytes(
        JSON.stringify({
          schemaVersion: manifest.schemaVersion,
          templateId,
          id: manifest.id,
          semanticVersion: manifest.semanticVersion,
          artifact,
          projectFormat: manifest.projectFormat,
          compatibility,
          capabilities,
          provenance,
        }),
      ),
    ),
  )}` as const;
  return { artifact, capabilities, compatibility, manifestHash, provenance };
}

/** Hydrates immutable version metadata from a Registry/repository release record. */
export function createSpaceTemplateVersionFromRelease({
  templateId,
  manifest,
  artifact,
  lock,
}: CreateSpaceTemplateVersionFromReleaseInput): SpaceTemplateVersion {
  if (lock.schemaVersion !== "vibechat.space-template-version-lock/v1") {
    throw new Error(
      `Space Template ${templateId}/${manifest.id} has an unsupported release lock`,
    );
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(lock.sourceHash)) {
    throw new Error(
      `Space Template ${templateId}/${manifest.id} has an invalid source hash`,
    );
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(lock.manifestHash)) {
    throw new Error(
      `Space Template ${templateId}/${manifest.id} has an invalid manifest hash`,
    );
  }
  const prepared = prepareSpaceTemplateVersion(
    templateId,
    manifest,
    artifact,
  );
  if (artifact.sourceHash !== lock.sourceHash) {
    throw new Error(
      `Space Template ${templateId}/${manifest.id} artifact and release lock disagree`,
    );
  }
  if (prepared.manifestHash !== lock.manifestHash) {
    throw new Error(
      `Space Template ${templateId}/${manifest.id} manifest drifted: expected ${lock.manifestHash}, received ${prepared.manifestHash}. Publish a new version instead.`,
    );
  }
  return Object.freeze({
    ...manifest,
    compatibility: prepared.compatibility,
    capabilities: prepared.capabilities,
    provenance: prepared.provenance,
    artifact: prepared.artifact,
    integrity: `template:${templateId}@${manifest.semanticVersion}+${prepared.manifestHash.replace(":", ".")}`,
    sourceHash: lock.sourceHash,
    manifestHash: prepared.manifestHash,
  });
}

/** Shared publication primitive for repository-authored and App-authored Templates. */
export function createSpaceTemplateVersion({
  templateId,
  manifest,
  project,
  lock,
}: CreateSpaceTemplateVersionInput): SpaceTemplateVersion {
  const sourceHash = hashSpaceTemplateProject(project);
  const artifact: SpaceTemplateArtifactRef = {
    schemaVersion: "vibechat.space-template-artifact/v1",
    id: `tpla-${sourceHash.slice("sha256:".length)}`,
    format: manifest.projectFormat,
    sourceHash,
  };
  const prepared = prepareSpaceTemplateVersion(templateId, manifest, artifact);

  if (lock?.sourceHash && sourceHash !== lock.sourceHash) {
    throw new Error(
      `Space Template ${templateId}/${manifest.id} source drifted: expected ${lock.sourceHash}, received ${sourceHash}. Publish a new version instead.`,
    );
  }
  if (lock?.manifestHash && prepared.manifestHash !== lock.manifestHash) {
    throw new Error(
      `Space Template ${templateId}/${manifest.id} manifest drifted: expected ${lock.manifestHash}, received ${prepared.manifestHash}. Publish a new version instead.`,
    );
  }

  return createSpaceTemplateVersionFromRelease({
    templateId,
    manifest,
    artifact,
    lock: {
      schemaVersion: "vibechat.space-template-version-lock/v1",
      sourceHash,
      manifestHash: prepared.manifestHash,
    },
  });
}

export function createSpaceTemplate(
  manifest: SpaceTemplateManifest,
  versions: readonly SpaceTemplateVersion[],
): SpaceTemplate {
  if (manifest.publisher.id.trim() === "") {
    throw new Error(`Space Template ${manifest.id} has no publisher`);
  }
  if (versions.some((version) => version.provenance.publisherId !== manifest.publisher.id)) {
    throw new Error(`Space Template ${manifest.id} version publisher does not match`);
  }
  assertSpaceTemplateVersionSequence(
    manifest.id,
    versions,
    manifest.currentVersionId,
  );
  return Object.freeze({
    ...manifest,
    publisher: Object.freeze({ ...manifest.publisher }),
    name: Object.freeze({ ...manifest.name }),
    summary: Object.freeze({ ...manifest.summary }),
    versions: Object.freeze([...versions]),
  });
}

export function createSpaceTemplateMarketEntry(
  template: SpaceTemplate,
  versionId = template.currentVersionId,
): SpaceTemplateMarketEntry {
  const version = template.versions.find((candidate) => candidate.id === versionId);
  if (!version) {
    throw new Error(`Space Template ${template.id} has no version ${versionId}`);
  }
  return Object.freeze({
    schemaVersion: "vibechat.space-template-market-entry/v1",
    id: template.id,
    versionId: version.id,
    semanticVersion: version.semanticVersion,
    integrity: version.integrity,
    sourceHash: version.sourceHash,
    manifestHash: version.manifestHash,
    artifact: version.artifact,
    projectFormat: version.projectFormat,
    compatibility: version.compatibility,
    provenance: version.provenance,
    publisher: template.publisher,
    category: template.category,
    name: template.name,
    summary: template.summary,
    author: template.author,
    icon: template.icon,
    accent: template.accent,
    canvas: template.canvas,
    permissions: [...version.capabilities.permissions],
    networkDomains: [...version.capabilities.networkDomains],
  });
}

export function isOfficialSpaceTemplate(template: SpaceTemplate) {
  return template.publisher.verification === "official";
}
