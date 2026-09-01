import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  getCurrentSpaceAppComponentManagedRelease,
  spaceAppComponentsPackageName,
  type SpaceAppComponentManagedRelease,
} from "@vibechat/space-app-components/node";

export interface SpaceAppComponentMigrationPlan {
  readonly changed: boolean;
  readonly packageName: typeof spaceAppComponentsPackageName;
  readonly from: {
    readonly version: string | null;
    readonly integrity: string | null;
  };
  readonly to: {
    readonly version: string;
    readonly integrity: `sha256:${string}`;
  };
  readonly files: Readonly<{
    "package.json": string;
    "space-app-dependencies.json": string;
  }>;
}

function parseProjectJson(
  files: Readonly<Record<string, string>>,
  path: string,
  fallback: Record<string, unknown>,
) {
  const source = files[path];
  if (source === undefined) return fallback;
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new TypeError(`Space App Project ${path} is not valid JSON`);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`Space App Project ${path} must contain an object`);
  }
  return value as Record<string, unknown>;
}

function stringRecord(value: unknown, field: string) {
  if (value === undefined) return {} as Record<string, unknown>;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`Space App Project ${field} must contain an object`);
  }
  return { ...(value as Record<string, unknown>) };
}

export function createSpaceAppComponentMigrationPlan(
  projectFiles: Readonly<Record<string, string>>,
  release: SpaceAppComponentManagedRelease,
): SpaceAppComponentMigrationPlan {
  const packageJson = parseProjectJson(projectFiles, "package.json", {});
  const dependencies = stringRecord(packageJson.dependencies, "package.json dependencies");
  const lock = parseProjectJson(projectFiles, "space-app-dependencies.json", {
    schemaVersion: "vibechat.space-app-dependencies/v1",
    packages: {},
  });
  if (
    lock.schemaVersion !== undefined
    && lock.schemaVersion !== "vibechat.space-app-dependencies/v1"
  ) {
    throw new TypeError("Space App Project dependency lock uses an unsupported schema");
  }
  const packages = stringRecord(lock.packages, "space-app-dependencies.json packages");
  const existingLock = packages[spaceAppComponentsPackageName];
  const existingPackage = existingLock
      && typeof existingLock === "object"
      && !Array.isArray(existingLock)
    ? existingLock as Record<string, unknown>
    : {};
  const fromVersion = typeof dependencies[spaceAppComponentsPackageName] === "string"
    ? dependencies[spaceAppComponentsPackageName] as string
    : null;
  const fromIntegrity = typeof existingPackage.integrity === "string"
    ? existingPackage.integrity
    : null;

  dependencies[spaceAppComponentsPackageName] = release.version;
  packages[spaceAppComponentsPackageName] = {
    version: release.version,
    integrity: release.integrity,
  };
  const nextPackageJson = `${JSON.stringify({
    ...packageJson,
    dependencies,
  }, null, 2)}\n`;
  const nextLock = `${JSON.stringify({
    ...lock,
    schemaVersion: "vibechat.space-app-dependencies/v1",
    packages,
  }, null, 2)}\n`;

  return Object.freeze({
    changed: projectFiles["package.json"] !== nextPackageJson
      || projectFiles["space-app-dependencies.json"] !== nextLock,
    packageName: spaceAppComponentsPackageName,
    from: Object.freeze({ version: fromVersion, integrity: fromIntegrity }),
    to: Object.freeze({ version: release.version, integrity: release.integrity }),
    files: Object.freeze({
      "package.json": nextPackageJson,
      "space-app-dependencies.json": nextLock,
    }),
  });
}

async function runCli() {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const positional = args.filter(
    (argument) => argument !== "--" && argument !== "--write",
  );
  if (positional.length !== 1 || positional[0]?.startsWith("-")) {
    throw new TypeError(
      "Usage: space-components:migration-plan -- /path/to/space-app-project [--write]",
    );
  }
  const [target] = positional;

  const root = resolve(process.cwd(), target);
  const packageJsonPath = resolve(root, "package.json");
  const dependencyLockPath = resolve(root, "space-app-dependencies.json");
  const packageJson = await readFile(packageJsonPath, "utf8");
  let dependencyLock: string | undefined;
  try {
    dependencyLock = await readFile(dependencyLockPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const plan = createSpaceAppComponentMigrationPlan({
    "package.json": packageJson,
    ...(dependencyLock === undefined
      ? {}
      : { "space-app-dependencies.json": dependencyLock }),
  }, getCurrentSpaceAppComponentManagedRelease());

  if (write && plan.changed) {
    await Promise.all([
      writeFile(packageJsonPath, plan.files["package.json"], "utf8"),
      writeFile(dependencyLockPath, plan.files["space-app-dependencies.json"], "utf8"),
    ]);
  }

  process.stdout.write(`${JSON.stringify({
    project: root,
    changed: plan.changed,
    written: write && plan.changed,
    package: plan.packageName,
    from: plan.from,
    to: plan.to,
    next: plan.changed && !write
      ? "Review the plan, re-run with --write, then build a Candidate and sign a new Template version or Project Revision."
      : plan.changed
        ? "Build a Candidate and sign a new Template version or Project Revision."
        : "Project already uses the current managed component release.",
  }, null, 2)}\n`);
}

if (
  process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  void runCli().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
