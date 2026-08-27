export const spaceComponentBundleSchemaVersion =
  "vibechat.space-component-bundle/v1" as const;

export interface SpaceComponentBundleManifest {
  schemaVersion: typeof spaceComponentBundleSchemaVersion;
  packageVersion: string;
  sdkRange: string;
  projectFormats: readonly string[];
  exports: readonly string[];
  sourceHash: `sha256:${string}`;
  artifactHash: `sha256:${string}`;
  cssTokenVersion: string;
}

const sha256Pattern = /^sha256:[a-f0-9]{64}$/;
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function isSpaceComponentBundleManifest(
  value: unknown,
): value is SpaceComponentBundleManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const manifest = value as Record<string, unknown>;
  return manifest.schemaVersion === spaceComponentBundleSchemaVersion
    && typeof manifest.packageVersion === "string"
    && semverPattern.test(manifest.packageVersion)
    && typeof manifest.sdkRange === "string"
    && manifest.sdkRange.length > 0
    && Array.isArray(manifest.projectFormats)
    && manifest.projectFormats.length > 0
    && manifest.projectFormats.every(
      (item) => typeof item === "string" && item.length > 0,
    )
    && Array.isArray(manifest.exports)
    && manifest.exports.length > 0
    && manifest.exports.every(
      (item) => typeof item === "string" && item.length > 0,
    )
    && typeof manifest.sourceHash === "string"
    && sha256Pattern.test(manifest.sourceHash)
    && typeof manifest.artifactHash === "string"
    && sha256Pattern.test(manifest.artifactHash)
    && typeof manifest.cssTokenVersion === "string"
    && semverPattern.test(manifest.cssTokenVersion);
}

export function assertSpaceComponentBundleManifest(
  value: unknown,
): asserts value is SpaceComponentBundleManifest {
  if (!isSpaceComponentBundleManifest(value)) {
    throw new TypeError("Invalid Space component bundle manifest");
  }
}
