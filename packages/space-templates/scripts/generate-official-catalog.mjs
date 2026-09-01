import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const officialRoot = join(packageRoot, "official");
const outputPath = join(packageRoot, "src", "official-catalog.generated.ts");
const requiredProjectPaths = ["package.json", "tsconfig.json", "src/index.ts"];
const forbiddenProjectSegments = new Set([
  ".git",
  ".data",
  ".pi-sessions",
  ".space-dev",
  "dist",
  "node_modules",
]);
const writeMissingLocks = process.argv.includes("--write-locks");
const rewriteDevelopmentLocks = process.argv.includes("--rewrite-development-locks");
const canonicalSemanticVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function parseSemanticVersion(value, context) {
  const match = canonicalSemanticVersionPattern.exec(value);
  assert(match, `${context}: semanticVersion must use canonical major.minor.patch SemVer`);
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

function compareSemanticVersions(left, right) {
  return left.major - right.major || left.minor - right.minor || left.patch - right.patch;
}

function isAdjacentSemanticVersion(previous, next) {
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

function versionPayloadFingerprint(version) {
  return JSON.stringify({
    sourceHash: version.lock.sourceHash,
    projectFormat: version.manifest.projectFormat,
    compatibility: version.manifest.compatibility,
    capabilities: {
      permissions: [...version.manifest.capabilities.permissions].sort(),
      networkDomains: [...version.manifest.capabilities.networkDomains].sort(),
    },
  });
}

function computeArtifact(sourceHash, projectFormat) {
  return {
    schemaVersion: "vibechat.space-template-artifact/v1",
    id: `tpla-${sourceHash.slice("sha256:".length)}`,
    format: projectFormat,
    sourceHash,
  };
}

function computeSourceHash(files) {
  const required = new Set(requiredProjectPaths);
  const canonicalPaths = [
    ...requiredProjectPaths,
    ...Object.keys(files).filter((path) => !required.has(path)).sort(),
  ];
  const canonicalSource = canonicalPaths
    .map((path) => `${path.length}:${path}:${files[path].length}:${files[path]}`)
    .join("");
  return sha256(canonicalSource);
}

function isProjectPath(path) {
  if (
    path.length === 0
    || path.length > 240
    || path.startsWith("/")
    || path.endsWith("/")
    || path.includes("\\")
    || path.includes("\0")
  ) return false;
  return path.split("/").every((segment) =>
    segment.length > 0
    && !segment.startsWith(".")
    && segment !== "."
    && segment !== ".."
    && !forbiddenProjectSegments.has(segment));
}

async function readProjectTree(root, context) {
  const files = {};
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = join(directory, entry.name);
      const projectPath = relative(root, absolutePath).split("\\").join("/");
      assert(isProjectPath(projectPath), `${context}: invalid project path ${projectPath}`);
      assert(!entry.isSymbolicLink(), `${context}: symlinks are not allowed (${projectPath})`);
      if (entry.isDirectory()) {
        await visit(absolutePath);
      } else {
        assert(entry.isFile(), `${context}: unsupported project entry ${projectPath}`);
        files[projectPath] = await readFile(absolutePath, "utf8");
      }
    }
  }
  await visit(root);
  for (const path of requiredProjectPaths) {
    assert(typeof files[path] === "string", `${context}: missing required project file ${path}`);
  }
  return files;
}

function computeManifestHash(templateId, version, sourceHash) {
  const artifact = computeArtifact(sourceHash, version.projectFormat);
  return sha256(JSON.stringify({
    schemaVersion: version.schemaVersion,
    templateId,
    id: version.id,
    semanticVersion: version.semanticVersion,
    artifact,
    projectFormat: version.projectFormat,
    compatibility: version.compatibility,
    capabilities: version.capabilities,
    provenance: version.provenance,
  }));
}

function computeVersionLock(templateId, version, files) {
  const sourceHash = computeSourceHash(files);
  return {
    schemaVersion: "vibechat.space-template-version-lock/v1",
    sourceHash,
    manifestHash: computeManifestHash(templateId, version, sourceHash),
  };
}

async function loadDefinition(directoryName) {
  const templateRoot = join(officialRoot, directoryName);
  const template = await readJson(join(templateRoot, "template.json"));
  assert(
    template.schemaVersion === "vibechat.space-template/v1",
    `${directoryName}: unsupported template schema`,
  );
  assert(template.id === directoryName, `${directoryName}: template id must match its directory`);
  assert(
    template.publisher?.verification === "official",
    `${directoryName}: repository templates must use an official publisher`,
  );

  const releaseIndexPath = join(templateRoot, "releases.json");
  const releaseIndex = await readJson(releaseIndexPath);
  assert(
    releaseIndex.schemaVersion === "vibechat.space-template-releases/v1",
    `${directoryName}: unsupported releases schema`,
  );
  assert(Array.isArray(releaseIndex.releases), `${directoryName}: releases must be an array`);
  const files = await readProjectTree(join(templateRoot, "app"), directoryName);
  const versions = [];
  let releaseIndexChanged = false;
  for (const [index, release] of releaseIndex.releases.entries()) {
    const version = release.manifest;
    const context = `${directoryName}@${version?.semanticVersion ?? index}`;
    assert(
      release.status === "development" || release.status === "published",
      `${context}: release status must be development or published`,
    );
    assert(
      version.schemaVersion === "vibechat.space-template-version/v1",
      `${context}: unsupported version schema`,
    );
    parseSemanticVersion(version.semanticVersion, context);
    assert(
      version.id === `tplv-${template.id}-${version.semanticVersion.replaceAll(".", "-")}`,
      `${context}: version id must match template id and semanticVersion`,
    );
    assert(
      version.provenance?.origin === "repository",
      `${context}: official source must use repository provenance`,
    );
    assert(
      version.provenance.publisherId === template.publisher.id,
      `${context}: publisher provenance does not match template publisher`,
    );
    assert(
      version.provenance.sourcePath === `packages/space-templates/official/${directoryName}/app`,
      `${context}: sourcePath must reference the single app working tree`,
    );
    let lock = release.lock;
    if (
      rewriteDevelopmentLocks
      && release.status === "development"
      && index === releaseIndex.releases.length - 1
    ) {
      lock = computeVersionLock(template.id, version, files);
      release.lock = lock;
      release.artifact = computeArtifact(lock.sourceHash, version.projectFormat);
      releaseIndexChanged = true;
      console.log(`Re-signed development baseline ${directoryName}@${version.semanticVersion}.`);
    }
    if (!lock && writeMissingLocks) {
      assert(
        release.status === "development",
        `${context}: a published release cannot be signed or rewritten`,
      );
      assert(
        index === releaseIndex.releases.length - 1,
        `${context}: only the latest release may be signed from the app working tree`,
      );
      lock = computeVersionLock(template.id, version, files);
      release.lock = lock;
      releaseIndexChanged = true;
      console.log(`Signed ${directoryName}@${version.semanticVersion}.`);
    }
    assert(
      lock?.schemaVersion === "vibechat.space-template-version-lock/v1",
      `${context}: release lock is required`,
    );
    assert(
      /^sha256:[a-f0-9]{64}$/.test(lock.sourceHash),
      `${context}: invalid sourceHash lock`,
    );
    assert(
      /^sha256:[a-f0-9]{64}$/.test(lock.manifestHash),
      `${context}: invalid manifestHash lock`,
    );
    const expectedArtifact = computeArtifact(lock.sourceHash, version.projectFormat);
    if (!release.artifact && writeMissingLocks) {
      release.artifact = expectedArtifact;
      releaseIndexChanged = true;
    }
    assert(
      JSON.stringify(release.artifact) === JSON.stringify(expectedArtifact),
      `${context}: artifact reference must match the source lock`,
    );
    assert(
      lock.manifestHash === computeManifestHash(template.id, version, lock.sourceHash),
      `${context}: manifestHash lock drifted; publish a new version`,
    );
    versions.push({ manifest: version, artifact: release.artifact, lock });
  }
  assert(
    versions.length > 0,
    `${directoryName}: at least one version is required`,
  );
  assert(
    versions[0].manifest.semanticVersion === "0.1.0",
    `${directoryName}: first version must be 0.1.0`,
  );
  for (let index = 1; index < versions.length; index += 1) {
    const previous = versions[index - 1];
    const version = versions[index];
    const previousParsed = parseSemanticVersion(
      previous.manifest.semanticVersion,
      `${directoryName}@${previous.manifest.semanticVersion}`,
    );
    const parsed = parseSemanticVersion(
      version.manifest.semanticVersion,
      `${directoryName}@${version.manifest.semanticVersion}`,
    );
    assert(
      compareSemanticVersions(previousParsed, parsed) < 0,
      `${directoryName}: versions must be strictly ordered`,
    );
    assert(
      isAdjacentSemanticVersion(previousParsed, parsed),
      `${directoryName}: cannot skip from ${previous.manifest.semanticVersion} to ${version.manifest.semanticVersion}`,
    );
    assert(
      versionPayloadFingerprint(previous) !== versionPayloadFingerprint(version),
      `${directoryName}@${version.manifest.semanticVersion}: immutable payload did not change`,
    );
  }
  const latest = versions[versions.length - 1];
  assert(
    latest.manifest.id === template.currentVersionId,
    `${directoryName}: currentVersionId must resolve to latest version ${latest.manifest.id}`,
  );
  const latestSourceHash = computeSourceHash(files);
  assert(
    latest.lock.sourceHash === latestSourceHash,
    `${directoryName}@${latest.manifest.semanticVersion}: app source drifted; publish a new version`,
  );
  if (releaseIndexChanged) {
    await writeFile(releaseIndexPath, `${JSON.stringify(releaseIndex, null, 2)}\n`, "utf8");
  }
  return { manifest: template, versions };
}

const directories = (await readdir(officialRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const definitions = await Promise.all(directories.map(loadDefinition));
const generated = `// Generated by scripts/generate-official-catalog.mjs. Do not edit.\n`+
  `export const officialTemplateDefinitions = ${JSON.stringify(definitions, null, 2)} as const;\n`;

if (process.argv.includes("--check")) {
  const existing = await readFile(outputPath, "utf8").catch(() => "");
  if (existing !== generated) {
    throw new Error(
      `${relative(packageRoot, outputPath)} is stale; run the space-templates generate script`,
    );
  }
} else {
  await writeFile(outputPath, generated, "utf8");
  console.log(`Generated ${relative(packageRoot, outputPath)} from ${definitions.length} official templates.`);
}
