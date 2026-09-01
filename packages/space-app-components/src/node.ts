import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createSpaceAppManagedPackageArtifact,
  type SpaceAppManagedPackageArtifact,
  type SpaceAppManagedPackageRegistry,
} from "@vibechat/space-app-dependencies";
import {
  assertSpaceComponentBundleManifest,
  spaceComponentBundleSchemaVersion,
  type SpaceComponentBundleManifest,
} from "./manifest.js";

export interface SpaceComponentBundle {
  manifest: SpaceComponentBundleManifest;
  files: Readonly<Record<string, string>>;
}

export interface CreateSpaceComponentBundleInput {
  packageVersion: string;
  sdkRange: string;
  projectFormats: readonly string[];
  exports: readonly string[];
  cssTokenVersion: string;
  sourceFiles: Readonly<Record<string, string>>;
  artifactFiles: Readonly<Record<string, string>>;
}

export const spaceAppComponentsPackageName =
  "@vibechat/space-app-components" as const;
export const spaceAppComponentManagedReleaseSchemaVersion =
  "vibechat.space-app-component-package-release/v1" as const;

export interface SpaceAppComponentManagedRelease {
  readonly schemaVersion: typeof spaceAppComponentManagedReleaseSchemaVersion;
  readonly name: typeof spaceAppComponentsPackageName;
  readonly version: string;
  readonly integrity: `sha256:${string}`;
  readonly packageFormat: "npm-package-v1";
  readonly projectFormats: readonly ["agentos-app-v1"];
  readonly componentBundle: {
    readonly sourceHash: `sha256:${string}`;
    readonly artifactHash: `sha256:${string}`;
  };
}

const exactVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const sha256Pattern = /^sha256:[a-f0-9]{64}$/;

function findPackageRoot(moduleUrl: string) {
  let current = dirname(fileURLToPath(moduleUrl));
  for (;;) {
    const packageJsonPath = join(current, "package.json");
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
        name?: unknown;
      };
      if (packageJson.name === spaceAppComponentsPackageName) return current;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error(`Cannot locate ${spaceAppComponentsPackageName} package root`);
}

const packageRoot = findPackageRoot(import.meta.url);
const managedReleasePath = join(packageRoot, "managed-release.json");
const localPublishedPackageRoot = join(packageRoot, "dist", "package");
const localManagedRegistryRoot = join(
  packageRoot,
  "dist",
  "managed-registry",
);

function assertSpaceAppComponentManagedRelease(
  value: unknown,
): asserts value is SpaceAppComponentManagedRelease {
  const release = value as Partial<SpaceAppComponentManagedRelease> | null;
  if (
    !release
    || release.schemaVersion !== spaceAppComponentManagedReleaseSchemaVersion
    || release.name !== spaceAppComponentsPackageName
    || typeof release.version !== "string"
    || !exactVersionPattern.test(release.version)
    || typeof release.integrity !== "string"
    || !sha256Pattern.test(release.integrity)
    || release.packageFormat !== "npm-package-v1"
    || !Array.isArray(release.projectFormats)
    || release.projectFormats.length !== 1
    || release.projectFormats[0] !== "agentos-app-v1"
    || !release.componentBundle
    || !sha256Pattern.test(release.componentBundle.sourceHash ?? "")
    || !sha256Pattern.test(release.componentBundle.artifactHash ?? "")
  ) {
    throw new TypeError("Invalid Space App component managed release");
  }
}

async function readManagedPackageFiles(root: string) {
  const files: Record<string, string> = {};
  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolute);
      } else if (entry.isFile()) {
        files[relative(root, absolute).split("\\").join("/")] =
          await readFile(absolute, "utf8");
      }
    }
  }
  await visit(root);
  return files;
}

export function getCurrentSpaceAppComponentManagedRelease() {
  const packageJson = JSON.parse(
    readFileSync(join(packageRoot, "package.json"), "utf8"),
  ) as { version?: unknown };
  if (typeof packageJson.version !== "string") {
    throw new TypeError("Space App component package has no version");
  }
  const release = JSON.parse(
    readFileSync(managedReleasePath, "utf8"),
  ) as unknown;
  assertSpaceAppComponentManagedRelease(release);
  if (release.version !== packageJson.version) {
    throw new TypeError("Space App component release does not match package version");
  }
  return Object.freeze(release);
}

export async function loadSpaceAppComponentManagedPackage(
  version: string,
  publishedPackageRoot?: string,
): Promise<SpaceAppManagedPackageArtifact> {
  if (!exactVersionPattern.test(version)) {
    throw new TypeError(`Invalid Space App component version: ${version}`);
  }
  const release = getCurrentSpaceAppComponentManagedRelease();
  assertSpaceAppComponentManagedRelease(release);
  const packageRoot = publishedPackageRoot
    ?? (release.version === version
      ? localPublishedPackageRoot
      : join(localManagedRegistryRoot, version, "package"));
  const files = await readManagedPackageFiles(packageRoot);
  let packageMetadata: { name?: unknown; version?: unknown };
  try {
    packageMetadata = JSON.parse(files["package.json"] ?? "null") as {
      name?: unknown;
      version?: unknown;
    };
  } catch {
    throw new TypeError(`Space App component package ${version} has invalid metadata`);
  }
  if (
    packageMetadata?.name !== spaceAppComponentsPackageName
    || packageMetadata.version !== version
  ) {
    throw new TypeError(`Space App component package ${version} has mismatched metadata`);
  }
  const artifact = createSpaceAppManagedPackageArtifact({
    name: spaceAppComponentsPackageName,
    version,
    projectFormats: ["agentos-app-v1"],
    files,
  });
  if (
    version === release.version
    && publishedPackageRoot === undefined
    && artifact.integrity !== release.integrity
  ) {
    throw new SpaceComponentManagedReleaseIntegrityError(
      release.integrity,
      artifact.integrity,
    );
  }
  return artifact;
}

export function createSpaceAppComponentManagedRegistry(
  loadPackage: (
    version: string,
  ) => Promise<SpaceAppManagedPackageArtifact> = loadSpaceAppComponentManagedPackage,
): SpaceAppManagedPackageRegistry {
  const registry: SpaceAppManagedPackageRegistry = {
    async resolve(input) {
      if (
        input.name !== spaceAppComponentsPackageName
        || input.projectFormat !== "agentos-app-v1"
      ) return null;
      try {
        const artifact = await loadPackage(input.version);
        if (artifact.integrity !== input.integrity) {
          throw new SpaceComponentManagedReleaseIntegrityError(
            input.integrity,
            artifact.integrity,
          );
        }
        return artifact;
      } catch (error) {
        if (
          error
          && typeof error === "object"
          && "code" in error
          && (error as { code?: unknown }).code === "ENOENT"
        ) return null;
        throw error;
      }
    },
  };
  return Object.freeze(registry);
}

function assertBundleFilePath(path: string) {
  if (
    !path
    || path.startsWith("/")
    || path.endsWith("/")
    || path.includes("\\")
    || path.includes("\0")
    || path.split("/").some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new TypeError(`Invalid Space component bundle path: ${path}`);
  }
}

function normalizeFiles(files: Readonly<Record<string, string>>) {
  const normalized: Record<string, string> = {};
  for (const path of Object.keys(files).sort()) {
    assertBundleFilePath(path);
    if (typeof files[path] !== "string") {
      throw new TypeError(`Space component bundle file ${path} must be text`);
    }
    normalized[path] = files[path];
  }
  if (Object.keys(normalized).length === 0) {
    throw new TypeError("Space component bundle must contain files");
  }
  return Object.freeze(normalized);
}

export function hashSpaceComponentFiles(
  files: Readonly<Record<string, string>>,
): `sha256:${string}` {
  const normalized = normalizeFiles(files);
  const hash = createHash("sha256");
  for (const path of Object.keys(normalized)) {
    hash.update(path).update("\0").update(normalized[path]).update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}

export function createSpaceComponentBundle(
  input: CreateSpaceComponentBundleInput,
): SpaceComponentBundle {
  const files = normalizeFiles(input.artifactFiles);
  const manifest: SpaceComponentBundleManifest = Object.freeze({
    schemaVersion: spaceComponentBundleSchemaVersion,
    packageVersion: input.packageVersion,
    sdkRange: input.sdkRange,
    projectFormats: Object.freeze([...input.projectFormats]),
    exports: Object.freeze([...input.exports]),
    sourceHash: hashSpaceComponentFiles(input.sourceFiles),
    artifactHash: hashSpaceComponentFiles(files),
    cssTokenVersion: input.cssTokenVersion,
  });
  assertSpaceComponentBundleManifest(manifest);
  return Object.freeze({ manifest, files });
}

export function assertSpaceComponentBundle(
  value: unknown,
): asserts value is SpaceComponentBundle {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Invalid Space component bundle");
  }
  const bundle = value as SpaceComponentBundle;
  assertSpaceComponentBundleManifest(bundle.manifest);
  const files = normalizeFiles(bundle.files);
  const artifactHash = hashSpaceComponentFiles(files);
  if (artifactHash !== bundle.manifest.artifactHash) {
    throw new SpaceComponentBundleIntegrityError(
      bundle.manifest.artifactHash,
      artifactHash,
    );
  }
  for (const path of bundle.manifest.exports) {
    if (typeof files[path] !== "string") {
      throw new TypeError(`Space component bundle is missing export ${path}`);
    }
  }
}

export function materializeSpaceComponentBundle(
  bundle: SpaceComponentBundle,
  prefix = "src/vendor/vibechat-space-components",
) {
  assertSpaceComponentBundle(bundle);
  assertBundleFilePath(`${prefix}/manifest.json`);
  const files: Record<string, string> = {};
  for (const path of Object.keys(bundle.files).sort()) {
    files[`${prefix}/${path}`] = bundle.files[path];
  }
  files[`${prefix}/manifest.json`] = `${JSON.stringify(bundle.manifest, null, 2)}\n`;
  return Object.freeze(files);
}

export class SpaceComponentBundleIntegrityError extends Error {
  constructor(expected: string, received: string) {
    super(
      `Space component bundle failed integrity validation: expected ${expected}, received ${received}`,
    );
    this.name = "SpaceComponentBundleIntegrityError";
  }
}

export class SpaceComponentManagedReleaseIntegrityError extends Error {
  constructor(expected: string, received: string) {
    super(
      `Space App component managed release failed integrity validation: expected ${expected}, received ${received}`,
    );
    this.name = "SpaceComponentManagedReleaseIntegrityError";
  }
}
