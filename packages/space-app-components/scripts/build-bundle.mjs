import {
  access,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createSpaceAppManagedPackageArtifact } from "@vibechat/space-app-dependencies";
import { build } from "esbuild";

import { createSpaceComponentBundle } from "../dist/esm/node.js";
import { spaceComponentCssTokenVersion } from "../dist/esm/foundation/styles.js";
import { renderSpaceComponentCatalogDocument } from "../dist/esm/testing.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = join(packageRoot, "src");
const distRoot = join(packageRoot, "dist");
const compiledRoot = join(distRoot, "esm");
const publishedPackageRoot = join(distRoot, "package");
const bundleRoot = join(distRoot, "bundles");
const managedReleasePath = join(packageRoot, "managed-release.json");
const packageJson = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
const writeRelease = process.argv.includes("--write-release");

const packageEntry = (path) => ({
  types: `./${path}.d.ts`,
  import: `./${path}.js`,
  default: `./${path}.js`,
});

const publishedExports = {
  ".": packageEntry("index"),
  "./core": packageEntry("core/index"),
  "./foundation": packageEntry("foundation/index"),
  "./user": packageEntry("user/index"),
  "./agent": packageEntry("agent/index"),
  "./chat": packageEntry("chat/index"),
  "./chat/inline": packageEntry("chat/inline"),
  "./register": packageEntry("browser"),
  "./register/foundation": packageEntry("foundation/browser"),
  "./register/user": packageEntry("user/browser"),
  "./register/agent": packageEntry("agent/browser"),
  "./register/chat": packageEntry("chat/browser"),
  "./styles": packageEntry("styles/index"),
  "./manifest": packageEntry("manifest"),
  "./package.json": "./package.json",
};

const publishedPackageJson = {
  name: packageJson.name,
  version: packageJson.version,
  description: packageJson.description,
  license: packageJson.license,
  type: "module",
  sideEffects: [
    "./browser.js",
    "./foundation/browser.js",
    "./user/browser.js",
    "./agent/browser.js",
    "./chat/browser.js",
  ],
  exports: publishedExports,
  peerDependencies: {
    "@vibechat/space-app-sdk": "0.1.0",
  },
  peerDependenciesMeta: {
    "@vibechat/space-app-sdk": { optional: true },
  },
};

async function readTree(root) {
  const files = {};
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolute);
      } else if (entry.isFile()) {
        const path = relative(root, absolute).split("\\").join("/");
        files[path] = await readFile(absolute, "utf8");
      }
    }
  }
  await visit(root);
  return files;
}

async function copyPublishedModules() {
  await rm(publishedPackageRoot, { recursive: true, force: true });
  const compiledFiles = await readTree(compiledRoot);
  for (const [path, source] of Object.entries(compiledFiles)) {
    if (/^(?:node|testing)\.(?:js|d\.ts)$/.test(path)) continue;
    const output = join(publishedPackageRoot, path);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, source, "utf8");
  }
}

async function readSourceFiles() {
  const files = Object.fromEntries(
    Object.entries(await readTree(sourceRoot)).map(([path, source]) => [
      `src/${path}`,
      source,
    ]),
  );
  files["package-contract.json"] = `${JSON.stringify({
    name: packageJson.name,
    version: packageJson.version,
    peerDependencies: publishedPackageJson.peerDependencies,
    exports: publishedExports,
  })}\n`;
  return files;
}

const browserEntries = {
  "browser.js": join(sourceRoot, "browser.ts"),
  "foundation.js": join(sourceRoot, "foundation/browser.ts"),
  "user.js": join(sourceRoot, "user/browser.ts"),
  "agent.js": join(sourceRoot, "agent/browser.ts"),
  "chat.js": join(sourceRoot, "chat/browser.ts"),
};
const bundleFiles = {};
for (const [name, entryPoint] of Object.entries(browserEntries)) {
  const result = await build({
    entryPoints: [entryPoint],
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
    target: "es2022",
    minify: true,
    legalComments: "none",
    charset: "utf8",
  });
  const source = result.outputFiles?.[0]?.text;
  if (!source) throw new Error(`Space component browser entry ${name} was empty`);
  bundleFiles[name] = source;
}

const bundle = createSpaceComponentBundle({
  packageVersion: packageJson.version,
  sdkRange: "v1",
  projectFormats: ["agentos-app-v1"],
  exports: Object.keys(bundleFiles),
  cssTokenVersion: spaceComponentCssTokenVersion,
  sourceFiles: await readSourceFiles(),
  artifactFiles: bundleFiles,
});

await copyPublishedModules();
await writeFile(
  join(publishedPackageRoot, "package.json"),
  `${JSON.stringify(publishedPackageJson, null, 2)}\n`,
  "utf8",
);
await writeFile(
  join(publishedPackageRoot, "README.md"),
  await readFile(join(packageRoot, "README.md"), "utf8"),
  "utf8",
);

const chatInlineModule = {
  schemaVersion: "vibechat.space-component-inline-module/v1",
  packageVersion: bundle.manifest.packageVersion,
  sdkRange: bundle.manifest.sdkRange,
  projectFormat: bundle.manifest.projectFormats[0],
  sourceHash: bundle.manifest.sourceHash,
  bundleHash: bundle.manifest.artifactHash,
  source: bundle.files["chat.js"],
};
await mkdir(join(publishedPackageRoot, "chat"), { recursive: true });
await writeFile(
  join(publishedPackageRoot, "chat", "inline.js"),
  `export const spaceChatInlineModule = Object.freeze(${JSON.stringify(chatInlineModule, null, 2)});\n`,
  "utf8",
);
await writeFile(
  join(publishedPackageRoot, "chat", "inline.d.ts"),
  `export interface SpaceChatInlineModule {
  readonly schemaVersion: "vibechat.space-component-inline-module/v1";
  readonly packageVersion: string;
  readonly sdkRange: string;
  readonly projectFormat: "agentos-app-v1";
  readonly sourceHash: \`sha256:\${string}\`;
  readonly bundleHash: \`sha256:\${string}\`;
  readonly source: string;
}
export declare const spaceChatInlineModule: Readonly<SpaceChatInlineModule>;
`,
  "utf8",
);

const managedPackage = createSpaceAppManagedPackageArtifact({
  name: packageJson.name,
  version: packageJson.version,
  projectFormats: ["agentos-app-v1"],
  files: await readTree(publishedPackageRoot),
});
const releaseManifest = {
  schemaVersion: "vibechat.space-app-component-package-release/v1",
  name: managedPackage.name,
  version: managedPackage.version,
  integrity: managedPackage.integrity,
  packageFormat: "npm-package-v1",
  projectFormats: managedPackage.projectFormats,
  componentBundle: {
    sourceHash: bundle.manifest.sourceHash,
    artifactHash: bundle.manifest.artifactHash,
  },
};

async function releaseExists() {
  try {
    await access(managedReleasePath);
    return true;
  } catch {
    return false;
  }
}

function compareVersions(left, right) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] - rightParts[index];
    }
  }
  return 0;
}

async function assertTrackedRelease() {
  if (!(await releaseExists())) {
    throw new Error(
      `Managed component release ${packageJson.version} is missing; run the release:prepare script once`,
    );
  }
  const trackedManifest = JSON.parse(await readFile(managedReleasePath, "utf8"));
  if (JSON.stringify(trackedManifest) !== JSON.stringify(releaseManifest)) {
    throw new Error(
      `Managed component release ${packageJson.version} is immutable and does not match the publishable package; bump the package version`,
    );
  }
}

async function writeTrackedRelease() {
  if (await releaseExists()) {
    const trackedManifest = JSON.parse(await readFile(managedReleasePath, "utf8"));
    if (trackedManifest.version === releaseManifest.version) {
      if (JSON.stringify(trackedManifest) !== JSON.stringify(releaseManifest)) {
        throw new Error(
          `Managed component release ${packageJson.version} already exists with different contents; bump the package version`,
        );
      }
      return;
    }
    if (compareVersions(releaseManifest.version, trackedManifest.version) <= 0) {
      throw new Error("Managed component release version must increase");
    }
  }
  await writeFile(
    managedReleasePath,
    `${JSON.stringify(releaseManifest, null, 2)}\n`,
    "utf8",
  );
}

await rm(bundleRoot, { recursive: true, force: true });
for (const [path, source] of Object.entries(bundle.files)) {
  const output = join(bundleRoot, path);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, source, "utf8");
}
await writeFile(
  join(distRoot, "manifest.json"),
  `${JSON.stringify(bundle.manifest, null, 2)}\n`,
  "utf8",
);
await writeFile(
  join(distRoot, "catalog.html"),
  renderSpaceComponentCatalogDocument({ bundle }),
  "utf8",
);

if (writeRelease) await writeTrackedRelease();
await assertTrackedRelease();

process.stdout.write(
  `Built publishable Space component package ${bundle.manifest.packageVersion} (${bundle.manifest.artifactHash}); managed package ${managedPackage.integrity}\n`,
);
