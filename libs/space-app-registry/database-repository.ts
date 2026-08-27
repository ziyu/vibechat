import { and, eq } from "drizzle-orm";
import { db, spaceAppManagedPackageRelease } from "@libs/database";
import type { SpaceAppProjectFormat } from "@vibechat/space-app-dependencies";

export interface ManagedPackageRelease {
  readonly releaseId: string;
  readonly name: string;
  readonly version: string;
  readonly integrity: `sha256:${string}`;
  readonly packageFormat: "vibechat-managed-package-v1";
  readonly projectFormats: readonly SpaceAppProjectFormat[];
  readonly objectKey: string;
  readonly objectHash: `sha256:${string}`;
  readonly createdAt: Date;
}

export interface ManagedPackageReleaseStore {
  find(name: string, version: string): Promise<ManagedPackageRelease | null>;
  publish(
    release: ManagedPackageRelease,
  ): Promise<{ readonly release: ManagedPackageRelease; readonly created: boolean }>;
}

export class DatabaseManagedPackageReleaseStore
implements ManagedPackageReleaseStore {
  async find(name: string, version: string) {
    const [row] = await db
      .select()
      .from(spaceAppManagedPackageRelease)
      .where(and(
        eq(spaceAppManagedPackageRelease.packageName, name),
        eq(spaceAppManagedPackageRelease.packageVersion, version),
      ))
      .limit(1);
    return row ? fromRow(row) : null;
  }

  async publish(release: ManagedPackageRelease) {
    const [inserted] = await db
      .insert(spaceAppManagedPackageRelease)
      .values({
        releaseId: release.releaseId,
        packageName: release.name,
        packageVersion: release.version,
        integrity: release.integrity,
        packageFormat: release.packageFormat,
        projectFormatsJson: [...release.projectFormats],
        objectKey: release.objectKey,
        objectHash: release.objectHash,
        createdAt: release.createdAt,
      })
      .onConflictDoNothing()
      .returning();
    if (inserted) {
      return Object.freeze({ release: fromRow(inserted), created: true });
    }
    const existing = await this.find(release.name, release.version);
    if (!existing) {
      throw new Error(
        `Managed package ${release.name}@${release.version} publish lost its immutable record`,
      );
    }
    if (!sameRelease(existing, release)) {
      throw new ManagedPackageReleaseConflictError(release.name, release.version);
    }
    return Object.freeze({ release: existing, created: false });
  }
}

function fromRow(row: typeof spaceAppManagedPackageRelease.$inferSelect) {
  return Object.freeze({
    releaseId: row.releaseId,
    name: row.packageName,
    version: row.packageVersion,
    integrity: row.integrity as `sha256:${string}`,
    packageFormat: row.packageFormat as ManagedPackageRelease["packageFormat"],
    projectFormats: Object.freeze(
      [...row.projectFormatsJson] as SpaceAppProjectFormat[],
    ),
    objectKey: row.objectKey,
    objectHash: row.objectHash as `sha256:${string}`,
    createdAt: row.createdAt,
  });
}

function sameRelease(
  left: ManagedPackageRelease,
  right: ManagedPackageRelease,
) {
  return left.releaseId === right.releaseId
    && left.name === right.name
    && left.version === right.version
    && left.integrity === right.integrity
    && left.packageFormat === right.packageFormat
    && JSON.stringify(left.projectFormats) === JSON.stringify(right.projectFormats)
    && left.objectKey === right.objectKey
    && left.objectHash === right.objectHash;
}

export class ManagedPackageReleaseConflictError extends Error {
  readonly code = "space_app_managed_package_release_conflict";

  constructor(name: string, version: string) {
    super(`Managed package ${name}@${version} already has different immutable content`);
    this.name = "ManagedPackageReleaseConflictError";
  }
}
