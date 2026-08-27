import {
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createSpaceAppManagedPackageArtifact,
  parseSpaceAppDependencyLock,
} from "@vibechat/space-app-dependencies";

const packageName = "@vibechat/space-app-components";
const packagePrefix =
  "vendor/vibechat-packages/vibechat/space-app-components/";
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const preparedProjectPath = process.argv[2];

if (!preparedProjectPath) {
  throw new Error(
    "Usage: pnpm registry:import-prepared <prepared-project-object.json>",
  );
}

const prepared = JSON.parse(await readFile(resolve(preparedProjectPath), "utf8"));
if (
  prepared?.schemaVersion !== "vibechat.prepared-space-app-project/v1"
  || !prepared.files
  || typeof prepared.files !== "object"
  || Array.isArray(prepared.files)
) {
  throw new TypeError("Invalid prepared Space App Project artifact");
}

const lock = parseSpaceAppDependencyLock(prepared.files);
const pin = lock?.packages[packageName];
if (!pin) {
  throw new TypeError(`Prepared Project does not pin ${packageName}`);
}

const files = Object.fromEntries(
  Object.entries(prepared.files)
    .filter(([path, source]) =>
      path.startsWith(packagePrefix) && typeof source === "string"
    )
    .map(([path, source]) => [path.slice(packagePrefix.length), source]),
);
const artifact = createSpaceAppManagedPackageArtifact({
  name: packageName,
  version: pin.version,
  projectFormats: ["agentos-app-v1"],
  files,
});
if (artifact.integrity !== pin.integrity) {
  throw new Error(
    `Prepared ${packageName}@${pin.version} failed integrity validation`,
  );
}

const cacheRoot = join(
  packageRoot,
  "dist",
  "managed-registry",
  pin.version,
  "package",
);
await rm(cacheRoot, { recursive: true, force: true });
for (const [path, source] of Object.entries(artifact.files)) {
  const output = join(cacheRoot, path);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, source, "utf8");
}

process.stdout.write(
  `Cached ${packageName}@${pin.version} (${artifact.integrity}) from prepared Project\n`,
);
