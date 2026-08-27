import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

export const spaceAppDependencyLockPath = "space-app-dependencies.json" as const;
export const spaceAppDependencyLockSchemaVersion =
  "vibechat.space-app-dependencies/v1" as const;
export const resolvedSpaceAppDependenciesPath =
  "vibechat.resolved-dependencies.json" as const;
export const resolvedSpaceAppDependenciesSchemaVersion =
  "vibechat.resolved-space-app-dependencies/v1" as const;
export const preparedSpaceAppProjectSchemaVersion =
  "vibechat.prepared-space-app-project/v1" as const;

export type SpaceAppProjectFormat = "agentos-app-v1";
export type SpaceAppProjectFiles = Record<string, string>;

export interface SpaceAppDependencyPin {
  readonly version: string;
  readonly integrity: `sha256:${string}`;
}

export interface SpaceAppDependencyLock {
  readonly schemaVersion: typeof spaceAppDependencyLockSchemaVersion;
  readonly packages: Readonly<Record<string, SpaceAppDependencyPin>>;
}

export interface SpaceAppManagedPackageArtifact {
  readonly name: string;
  readonly version: string;
  readonly integrity: `sha256:${string}`;
  readonly projectFormats: readonly SpaceAppProjectFormat[];
  readonly files: Readonly<Record<string, string>>;
}

export interface SpaceAppManagedPackageRegistry {
  resolve(input: {
    readonly name: string;
    readonly version: string;
    readonly integrity: `sha256:${string}`;
    readonly projectFormat: SpaceAppProjectFormat;
  }): Promise<SpaceAppManagedPackageArtifact | null>;
}

export function composeSpaceAppManagedPackageRegistries(
  registries: readonly SpaceAppManagedPackageRegistry[],
): SpaceAppManagedPackageRegistry {
  const providers = Object.freeze([...registries]);
  const registry: SpaceAppManagedPackageRegistry = {
    async resolve(input) {
      for (const registry of providers) {
        const artifact = await registry.resolve(input);
        if (artifact) return artifact;
      }
      return null;
    },
  };
  return Object.freeze(registry);
}

export interface ResolvedSpaceAppDependency {
  readonly name: string;
  readonly version: string;
  readonly integrity: `sha256:${string}`;
  readonly path: string;
}

export interface PreparedSpaceAppProject {
  readonly schemaVersion: typeof preparedSpaceAppProjectSchemaVersion;
  readonly sourceHash: `sha256:${string}`;
  readonly artifactHash: `sha256:${string}`;
  readonly files: SpaceAppProjectFiles;
  readonly dependencies: readonly ResolvedSpaceAppDependency[];
  readonly importPaths: Readonly<Record<string, string>>;
}

const exactVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const packageNamePattern = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const integrityPattern = /^sha256:[a-f0-9]{64}$/;
const generatedPackageRoot = "vendor/vibechat-packages";

function assertSafePath(path: string) {
  if (
    !path
    || path.startsWith("/")
    || path.endsWith("/")
    || path.includes("\\")
    || path.includes("\0")
    || path.split("/").some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new TypeError(`Invalid managed package path: ${path}`);
  }
}

function normalizeFiles(files: Readonly<Record<string, string>>) {
  const normalized: Record<string, string> = {};
  for (const path of Object.keys(files).sort()) {
    assertSafePath(path);
    if (typeof files[path] !== "string") {
      throw new TypeError(`Managed package file ${path} must be text`);
    }
    normalized[path] = files[path];
  }
  if (Object.keys(normalized).length === 0) {
    throw new TypeError("Managed package artifact must contain files");
  }
  return normalized;
}

export function hashSpaceAppDependencyFiles(
  files: Readonly<Record<string, string>>,
): `sha256:${string}` {
  const normalized = normalizeFiles(files);
  const canonical = Object.keys(normalized)
    .map((path) => `${path.length}:${path}:${normalized[path].length}:${normalized[path]}`)
    .join("");
  return `sha256:${bytesToHex(sha256(utf8ToBytes(canonical)))}`;
}

export function createSpaceAppManagedPackageArtifact(input: {
  readonly name: string;
  readonly version: string;
  readonly projectFormats: readonly SpaceAppProjectFormat[];
  readonly files: Readonly<Record<string, string>>;
}): SpaceAppManagedPackageArtifact {
  if (!packageNamePattern.test(input.name)) {
    throw new TypeError(`Invalid managed package name: ${input.name}`);
  }
  if (!exactVersionPattern.test(input.version)) {
    throw new TypeError(`Managed package ${input.name} must use an exact version`);
  }
  if (!input.projectFormats.includes("agentos-app-v1")) {
    throw new TypeError(`Managed package ${input.name} has no supported Project format`);
  }
  const files = Object.freeze(normalizeFiles(input.files));
  return Object.freeze({
    name: input.name,
    version: input.version,
    integrity: hashSpaceAppDependencyFiles(files),
    projectFormats: Object.freeze([...input.projectFormats]),
    files,
  });
}

export function parseSpaceAppDependencyLock(
  files: Readonly<Record<string, string>>,
): SpaceAppDependencyLock | null {
  const source = files[spaceAppDependencyLockPath];
  if (source === undefined) return null;
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new TypeError(`${spaceAppDependencyLockPath} must contain valid JSON`);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`Invalid ${spaceAppDependencyLockPath}`);
  }
  const lock = value as Record<string, unknown>;
  if (
    lock.schemaVersion !== spaceAppDependencyLockSchemaVersion
    || !lock.packages
    || typeof lock.packages !== "object"
    || Array.isArray(lock.packages)
  ) {
    throw new TypeError(`Invalid ${spaceAppDependencyLockPath}`);
  }
  const packages: Record<string, SpaceAppDependencyPin> = {};
  for (const name of Object.keys(lock.packages as Record<string, unknown>).sort()) {
    const pin = (lock.packages as Record<string, unknown>)[name];
    if (
      !packageNamePattern.test(name)
      || !pin
      || typeof pin !== "object"
      || Array.isArray(pin)
    ) {
      throw new TypeError(`Invalid managed package pin ${name}`);
    }
    const fields = pin as Record<string, unknown>;
    if (
      typeof fields.version !== "string"
      || !exactVersionPattern.test(fields.version)
      || typeof fields.integrity !== "string"
      || !integrityPattern.test(fields.integrity)
    ) {
      throw new TypeError(`Invalid managed package pin ${name}`);
    }
    packages[name] = Object.freeze({
      version: fields.version,
      integrity: fields.integrity as `sha256:${string}`,
    });
  }
  if (Object.keys(packages).length === 0) {
    throw new TypeError(`${spaceAppDependencyLockPath} must pin at least one package`);
  }
  return Object.freeze({
    schemaVersion: spaceAppDependencyLockSchemaVersion,
    packages: Object.freeze(packages),
  });
}

function parsePackageJson(files: Readonly<Record<string, string>>) {
  let value: unknown;
  try {
    value = JSON.parse(files["package.json"] ?? "");
  } catch {
    throw new TypeError("Space App package.json must contain valid JSON");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Space App package.json must contain an object");
  }
  const packageJson = value as Record<string, unknown>;
  if (
    packageJson.dependencies !== undefined
    && (
      !packageJson.dependencies
      || typeof packageJson.dependencies !== "object"
      || Array.isArray(packageJson.dependencies)
    )
  ) {
    throw new TypeError("Space App package.json dependencies must be an object");
  }
  return packageJson;
}

function packagePath(name: string) {
  const normalized = name.startsWith("@") ? name.slice(1) : name;
  return `${generatedPackageRoot}/${normalized}`;
}

function packageExportImportPaths(
  name: string,
  root: string,
  files: Readonly<Record<string, string>>,
) {
  const packageJson = JSON.parse(files["package.json"] ?? "null") as {
    exports?: unknown;
  } | null;
  if (!packageJson || typeof packageJson.exports !== "object" || !packageJson.exports) {
    throw new TypeError(`Managed package ${name} must declare exports`);
  }
  const imports: Record<string, string> = {};
  for (const [key, target] of Object.entries(packageJson.exports)) {
    const importTarget = typeof target === "string"
      ? target
      : target && typeof target === "object" && !Array.isArray(target)
        ? (target as Record<string, unknown>).import
          ?? (target as Record<string, unknown>).default
        : undefined;
    if (typeof importTarget !== "string" || !importTarget.startsWith("./")) continue;
    const specifier = key === "." ? name : `${name}/${key.replace(/^\.\//, "")}`;
    imports[specifier] = `${root}/${importTarget.slice(2)}`;
  }
  return imports;
}

function equalJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sameFiles(
  left: Readonly<Record<string, string>>,
  right: Readonly<Record<string, string>>,
) {
  const leftPaths = Object.keys(left).sort();
  const rightPaths = Object.keys(right).sort();
  return equalJson(leftPaths, rightPaths)
    && leftPaths.every((path) => left[path] === right[path]);
}

function assertManagedScopeIsLocked(
  dependencies: Record<string, unknown>,
  lock: SpaceAppDependencyLock | null,
  managedScopes: readonly string[],
) {
  for (const name of Object.keys(dependencies)) {
    if (
      managedScopes.some((scope) => name.startsWith(scope))
      && !lock?.packages[name]
    ) {
      throw new SpaceAppDependencyResolutionError(
        "space_app_dependency_not_locked",
        `Managed dependency ${name} must be pinned in ${spaceAppDependencyLockPath}`,
      );
    }
  }
}

export async function prepareSpaceAppProject(input: {
  readonly files: Readonly<Record<string, string>>;
  readonly registry: SpaceAppManagedPackageRegistry;
  readonly projectFormat?: SpaceAppProjectFormat;
  readonly managedScopes?: readonly string[];
}): Promise<PreparedSpaceAppProject> {
  const sourceFiles = Object.freeze(normalizeFiles(input.files));
  const sourceHash = hashSpaceAppDependencyFiles(sourceFiles);
  const lock = parseSpaceAppDependencyLock(sourceFiles);
  const packageJson = parsePackageJson(sourceFiles);
  const dependencies = {
    ...((packageJson.dependencies ?? {}) as Record<string, unknown>),
  };
  assertManagedScopeIsLocked(
    dependencies,
    lock,
    input.managedScopes ?? ["@vibechat/"],
  );
  if (!lock) {
    return Object.freeze({
      schemaVersion: preparedSpaceAppProjectSchemaVersion,
      sourceHash,
      artifactHash: sourceHash,
      files: { ...sourceFiles },
      dependencies: Object.freeze([]),
      importPaths: Object.freeze({}),
    });
  }
  if (
    sourceFiles[resolvedSpaceAppDependenciesPath] !== undefined
    || Object.keys(sourceFiles).some((path) => path.startsWith(`${generatedPackageRoot}/`))
  ) {
    throw new SpaceAppDependencyResolutionError(
      "space_app_dependency_generated_path_collision",
      "Space App source cannot contain generated managed dependency paths",
    );
  }

  const projectFormat = input.projectFormat ?? "agentos-app-v1";
  const preparedFiles: SpaceAppProjectFiles = { ...sourceFiles };
  const resolved: ResolvedSpaceAppDependency[] = [];
  const importPaths: Record<string, string> = {};
  for (const name of Object.keys(lock.packages).sort()) {
    const pin = lock.packages[name];
    if (dependencies[name] !== pin.version) {
      throw new SpaceAppDependencyResolutionError(
        "space_app_dependency_version_mismatch",
        `Managed dependency ${name} must use exact version ${pin.version} in package.json`,
      );
    }
    const artifact = await input.registry.resolve({
      name,
      version: pin.version,
      integrity: pin.integrity,
      projectFormat,
    });
    if (!artifact) {
      throw new SpaceAppDependencyResolutionError(
        "space_app_dependency_unavailable",
        `Managed dependency ${name}@${pin.version} is unavailable`,
      );
    }
    const actualIntegrity = hashSpaceAppDependencyFiles(artifact.files);
    if (
      artifact.name !== name
      || artifact.version !== pin.version
      || artifact.integrity !== pin.integrity
      || actualIntegrity !== pin.integrity
      || !artifact.projectFormats.includes(projectFormat)
    ) {
      throw new SpaceAppDependencyResolutionError(
        "space_app_dependency_integrity_mismatch",
        `Managed dependency ${name}@${pin.version} failed integrity validation`,
      );
    }
    const root = packagePath(name);
    for (const [path, content] of Object.entries(normalizeFiles(artifact.files))) {
      preparedFiles[`${root}/${path}`] = content;
    }
    Object.assign(importPaths, packageExportImportPaths(name, root, artifact.files));
    dependencies[name] = `file:${root}`;
    resolved.push(Object.freeze({
      name,
      version: pin.version,
      integrity: pin.integrity,
      path: root,
    }));
  }
  preparedFiles["package.json"] = `${JSON.stringify({
    ...packageJson,
    dependencies,
  }, null, 2)}\n`;
  preparedFiles[resolvedSpaceAppDependenciesPath] = `${JSON.stringify({
    schemaVersion: resolvedSpaceAppDependenciesSchemaVersion,
    sourceHash,
    packages: resolved,
  }, null, 2)}\n`;
  const artifactHash = hashSpaceAppDependencyFiles(preparedFiles);
  return Object.freeze({
    schemaVersion: preparedSpaceAppProjectSchemaVersion,
    sourceHash,
    artifactHash,
    files: preparedFiles,
    dependencies: Object.freeze(resolved),
    importPaths: Object.freeze(importPaths),
  });
}

export function assertPreparedSpaceAppProject(
  sourceFiles: Readonly<Record<string, string>>,
  prepared: PreparedSpaceAppProject,
) {
  if (
    !prepared
    || typeof prepared !== "object"
    || prepared.schemaVersion !== preparedSpaceAppProjectSchemaVersion
    || !prepared.files
    || typeof prepared.files !== "object"
    || Array.isArray(prepared.files)
    || !Array.isArray(prepared.dependencies)
    || !prepared.importPaths
    || typeof prepared.importPaths !== "object"
    || Array.isArray(prepared.importPaths)
    || prepared.sourceHash !== hashSpaceAppDependencyFiles(sourceFiles)
    || prepared.artifactHash !== hashSpaceAppDependencyFiles(prepared.files)
  ) {
    throw new SpaceAppDependencyResolutionError(
      "space_app_prepared_project_integrity_mismatch",
      "Prepared Space App dependency artifact failed integrity validation",
    );
  }
  const manifestSource = prepared.files[resolvedSpaceAppDependenciesPath];
  if (prepared.dependencies.length === 0) {
    if (
      manifestSource !== undefined
      || Object.keys(prepared.importPaths).length > 0
      || prepared.artifactHash !== prepared.sourceHash
      || !sameFiles(sourceFiles, prepared.files)
      || parseSpaceAppDependencyLock(sourceFiles) !== null
    ) {
      throw new SpaceAppDependencyResolutionError(
        "space_app_prepared_project_integrity_mismatch",
        "Prepared Space App contains unexpected dependency metadata",
      );
    }
    return;
  }
  const sourceLock = parseSpaceAppDependencyLock(sourceFiles);
  if (!sourceLock) {
    throw new SpaceAppDependencyResolutionError(
      "space_app_prepared_project_integrity_mismatch",
      "Prepared Space App dependencies have no source lock",
    );
  }
  if (!manifestSource) {
    throw new SpaceAppDependencyResolutionError(
      "space_app_prepared_project_integrity_mismatch",
      "Prepared Space App is missing resolved dependency metadata",
    );
  }
  let manifest: {
    schemaVersion?: unknown;
    sourceHash?: unknown;
    packages?: unknown;
  };
  try {
    manifest = JSON.parse(manifestSource) as typeof manifest;
  } catch {
    throw new SpaceAppDependencyResolutionError(
      "space_app_prepared_project_integrity_mismatch",
      "Prepared Space App dependency metadata is not valid JSON",
    );
  }
  if (
    manifest.schemaVersion !== resolvedSpaceAppDependenciesSchemaVersion
    || manifest.sourceHash !== prepared.sourceHash
    || !equalJson(manifest.packages, prepared.dependencies)
  ) {
    throw new SpaceAppDependencyResolutionError(
      "space_app_prepared_project_integrity_mismatch",
      "Prepared Space App dependency metadata does not match its artifact",
    );
  }

  const sourcePackageJson = parsePackageJson(sourceFiles);
  const sourceDependencies = {
    ...((sourcePackageJson.dependencies ?? {}) as Record<string, unknown>),
  };
  const lockedNames = Object.keys(sourceLock.packages).sort();
  if (lockedNames.length !== prepared.dependencies.length) {
    throw new SpaceAppDependencyResolutionError(
      "space_app_prepared_project_integrity_mismatch",
      "Prepared Space App dependencies do not match its source lock",
    );
  }
  const expectedImports: Record<string, string> = {};
  const expectedDependencies = { ...sourceDependencies };
  for (const [index, dependency] of prepared.dependencies.entries()) {
    const lockedName = lockedNames[index];
    const pin = sourceLock.packages[lockedName];
    if (
      !packageNamePattern.test(dependency.name)
      || !exactVersionPattern.test(dependency.version)
      || !integrityPattern.test(dependency.integrity)
      || dependency.name !== lockedName
      || dependency.version !== pin.version
      || dependency.integrity !== pin.integrity
      || dependency.path !== packagePath(dependency.name)
      || sourceDependencies[dependency.name] !== dependency.version
    ) {
      throw new SpaceAppDependencyResolutionError(
        "space_app_prepared_project_integrity_mismatch",
        "Prepared Space App contains invalid dependency metadata",
      );
    }
    const prefix = `${dependency.path}/`;
    const packageFiles = Object.fromEntries(
      Object.entries(prepared.files)
        .filter(([path]) => path.startsWith(prefix))
        .map(([path, content]) => [path.slice(prefix.length), content]),
    );
    if (
      Object.keys(packageFiles).length === 0
      || hashSpaceAppDependencyFiles(packageFiles) !== dependency.integrity
    ) {
      throw new SpaceAppDependencyResolutionError(
        "space_app_prepared_project_integrity_mismatch",
        `Prepared Space App package ${dependency.name}@${dependency.version} failed integrity validation`,
      );
    }
    Object.assign(
      expectedImports,
      packageExportImportPaths(dependency.name, dependency.path, packageFiles),
    );
    expectedDependencies[dependency.name] = `file:${dependency.path}`;
  }
  const expectedPackageJson = `${JSON.stringify({
    ...sourcePackageJson,
    dependencies: expectedDependencies,
  }, null, 2)}\n`;
  if (prepared.files["package.json"] !== expectedPackageJson) {
    throw new SpaceAppDependencyResolutionError(
      "space_app_prepared_project_integrity_mismatch",
      "Prepared Space App package.json does not match its source dependencies",
    );
  }
  const sourcePaths = new Set(Object.keys(sourceFiles));
  const generatedPrefixes = prepared.dependencies.map(
    (dependency) => `${dependency.path}/`,
  );
  for (const [path, content] of Object.entries(sourceFiles)) {
    if (path !== "package.json" && prepared.files[path] !== content) {
      throw new SpaceAppDependencyResolutionError(
        "space_app_prepared_project_integrity_mismatch",
        `Prepared Space App changed source file ${path}`,
      );
    }
  }
  for (const path of Object.keys(prepared.files)) {
    if (
      sourcePaths.has(path)
      || path === resolvedSpaceAppDependenciesPath
      || generatedPrefixes.some((prefix) => path.startsWith(prefix))
    ) continue;
    throw new SpaceAppDependencyResolutionError(
      "space_app_prepared_project_integrity_mismatch",
      `Prepared Space App contains unexpected generated file ${path}`,
    );
  }
  if (!equalJson(expectedImports, prepared.importPaths)) {
    throw new SpaceAppDependencyResolutionError(
      "space_app_prepared_project_integrity_mismatch",
      "Prepared Space App import map does not match its dependency artifacts",
    );
  }
}

export class SpaceAppDependencyResolutionError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "SpaceAppDependencyResolutionError";
  }
}
