import type { RuntimeObjectStore } from "@libs/space-runtime-control";
import {
  parseSpaceAppManagedPackageObject,
  serializeSpaceAppManagedPackageObject,
  spaceAppManagedPackageFormat,
  type SpaceAppManagedPackageArtifact,
  type SpaceAppManagedPackageResolution,
} from "@vibechat/space-app-dependencies";
import type {
  ManagedPackageRelease,
  ManagedPackageReleaseStore,
} from "./database-repository";
import { ManagedPackageReleaseConflictError } from "./database-repository";

const managedPackageContentType =
  "application/vnd.vibechat.space-app-managed-package+json; charset=utf-8";

export async function publishSpaceAppManagedPackage(input: {
  readonly artifact: SpaceAppManagedPackageArtifact;
  readonly releases: ManagedPackageReleaseStore;
  readonly objects: RuntimeObjectStore;
  readonly now?: Date;
}) {
  const content = new TextEncoder().encode(
    serializeSpaceAppManagedPackageObject(input.artifact),
  );
  const contentHash = await sha256(content);
  const existing = await input.releases.find(
    input.artifact.name,
    input.artifact.version,
  );
  if (existing && !samePublishedContent(existing, {
    integrity: input.artifact.integrity,
    packageFormat: spaceAppManagedPackageFormat,
    projectFormats: input.artifact.projectFormats,
    objectHash: contentHash,
  })) {
    throw new ManagedPackageReleaseConflictError(
      input.artifact.name,
      input.artifact.version,
    );
  }
  const stored = await input.objects.put(content, managedPackageContentType);
  const release: ManagedPackageRelease = Object.freeze({
    releaseId: `managed-package:${input.artifact.name}@${input.artifact.version}`,
    name: input.artifact.name,
    version: input.artifact.version,
    integrity: input.artifact.integrity,
    packageFormat: spaceAppManagedPackageFormat,
    projectFormats: Object.freeze([...input.artifact.projectFormats]),
    objectKey: stored.objectKey,
    objectHash: stored.hash,
    createdAt: input.now ?? new Date(),
  });
  return input.releases.publish(release);
}

function samePublishedContent(
  existing: ManagedPackageRelease,
  expected: Pick<
    ManagedPackageRelease,
    "integrity" | "packageFormat" | "projectFormats" | "objectHash"
  >,
) {
  return existing.integrity === expected.integrity
    && existing.packageFormat === expected.packageFormat
    && JSON.stringify(existing.projectFormats) === JSON.stringify(expected.projectFormats)
    && existing.objectHash === expected.objectHash;
}

export async function resolveSpaceAppManagedPackage(input: {
  readonly request: SpaceAppManagedPackageResolution;
  readonly releases: ManagedPackageReleaseStore;
  readonly objects: RuntimeObjectStore;
}): Promise<SpaceAppManagedPackageArtifact | null> {
  const release = await input.releases.find(
    input.request.name,
    input.request.version,
  );
  if (!release) return null;
  if (
    release.integrity !== input.request.integrity
    || !release.projectFormats.includes(input.request.projectFormat)
  ) {
    throw new ManagedPackageResolutionIntegrityError(
      input.request.name,
      input.request.version,
    );
  }
  const content = await input.objects.get(release.objectKey);
  if (!content) {
    throw new ManagedPackageObjectUnavailableError(
      input.request.name,
      input.request.version,
    );
  }
  if (await sha256(content) !== release.objectHash) {
    throw new ManagedPackageResolutionIntegrityError(
      input.request.name,
      input.request.version,
    );
  }
  let object;
  try {
    object = parseSpaceAppManagedPackageObject(new TextDecoder().decode(content));
  } catch {
    throw new ManagedPackageResolutionIntegrityError(
      input.request.name,
      input.request.version,
    );
  }
  if (
    object.name !== release.name
    || object.version !== release.version
    || object.integrity !== release.integrity
    || object.packageFormat !== release.packageFormat
    || JSON.stringify(object.projectFormats) !== JSON.stringify(release.projectFormats)
  ) {
    throw new ManagedPackageResolutionIntegrityError(
      input.request.name,
      input.request.version,
    );
  }
  return Object.freeze({
    name: object.name,
    version: object.version,
    integrity: object.integrity,
    projectFormats: object.projectFormats,
    files: object.files,
  });
}

async function sha256(content: Uint8Array): Promise<`sha256:${string}`> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    Uint8Array.from(content).buffer,
  );
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
}

export class ManagedPackageObjectUnavailableError extends Error {
  readonly code = "space_app_managed_package_object_unavailable";

  constructor(name: string, version: string) {
    super(`Managed package ${name}@${version} object is unavailable`);
    this.name = "ManagedPackageObjectUnavailableError";
  }
}

export class ManagedPackageResolutionIntegrityError extends Error {
  readonly code = "space_app_managed_package_resolution_integrity_mismatch";

  constructor(name: string, version: string) {
    super(`Managed package ${name}@${version} failed Registry integrity validation`);
    this.name = "ManagedPackageResolutionIntegrityError";
  }
}
