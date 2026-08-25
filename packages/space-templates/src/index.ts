import { officialTemplateDefinitions } from "./official-catalog.generated.js";
import {
  createSpaceTemplate,
  createSpaceTemplateMarketEntry,
  createSpaceTemplateVersionFromRelease,
  type SpaceTemplate,
  type SpaceTemplateManifest,
  type SpaceTemplateVersionLock,
  type SpaceTemplateVersionManifest,
} from "./registry.js";

export {
  canonicalizeSpaceTemplateProjectFiles,
  assertSpaceTemplateVersionSequence,
  createSpaceTemplate,
  createSpaceTemplateMarketEntry,
  createSpaceTemplateVersion,
  createSpaceTemplateVersionFromRelease,
  hashSpaceTemplateProject,
  hashSpaceTemplateProjectFiles,
  isSpaceTemplateProjectFilePath,
  isOfficialSpaceTemplate,
  parseSpaceTemplateSemanticVersion,
  spaceTemplateRequiredProjectPaths,
  sortedSpaceTemplateProjectPaths,
  type CreateSpaceTemplateVersionInput,
  type CreateSpaceTemplateVersionFromReleaseInput,
  type ParsedSpaceTemplateSemanticVersion,
  type SpaceTemplate,
  type SpaceTemplateArtifactRef,
  type SpaceTemplateCapabilities,
  type SpaceTemplateCategory,
  type SpaceTemplateCompatibility,
  type SpaceTemplateManifest,
  type SpaceTemplateMarketEntry,
  type SpaceTemplateProject,
  type SpaceTemplateProjectFiles,
  type SpaceTemplateProvenance,
  type SpaceTemplatePublisher,
  type SpaceTemplatePublisherVerification,
  type SpaceTemplateVersion,
  type SpaceTemplateVersionLock,
  type SpaceTemplateVersionManifest,
} from "./registry.js";

function toOfficialTemplate(
  definition: (typeof officialTemplateDefinitions)[number],
): SpaceTemplate {
  const manifest = definition.manifest as SpaceTemplateManifest;
  const versions = definition.versions.map((definitionVersion) =>
    createSpaceTemplateVersionFromRelease({
      templateId: manifest.id,
      manifest: definitionVersion.manifest as SpaceTemplateVersionManifest,
      artifact: definitionVersion.artifact,
      lock: definitionVersion.lock as SpaceTemplateVersionLock,
    }),
  );
  return createSpaceTemplate(manifest, versions);
}

/** Repository-authored Templates. Production publishes these into the same Market as user Templates. */
export const officialSpaceTemplates: readonly SpaceTemplate[] = Object.freeze(
  officialTemplateDefinitions.map(toOfficialTemplate),
);

/** Official repository publications, materialized in the common Market protocol. */
export const officialSpaceTemplateMarketEntries = Object.freeze(
  officialSpaceTemplates.map((template) => createSpaceTemplateMarketEntry(template)),
);

export function getOfficialSpaceTemplate(templateId: string) {
  return officialSpaceTemplates.find((template) => template.id === templateId) ?? null;
}

export function getOfficialSpaceTemplateVersion(
  templateId: string,
  versionId: string,
) {
  const template = getOfficialSpaceTemplate(templateId);
  if (!template) return null;
  const exact = template.versions.find((version) => version.id === versionId);
  if (exact) return exact;

  // Development data created before ordered SemVer used synthetic builtin
  // v1..v5 IDs or the mistaken 5.0.0 publication ID. Resolve those aliases to
  // the current official version without ever emitting them for new Spaces or
  // market responses.
  const legacyVersionIds = new Set([
    ...Array.from({ length: 5 }, (_, index) => `builtin-${templateId}-v${index + 1}`),
    `tplv-${templateId}-5-0-0`,
  ]);
  if (legacyVersionIds.has(versionId)) {
    return template.versions.find(
      (version) => version.id === template.currentVersionId,
    ) ?? null;
  }
  return null;
}
