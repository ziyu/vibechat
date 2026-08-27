import { createHash } from "node:crypto";
import type { RuntimeObjectStore } from "@libs/space-runtime-control";
import {
  ManagedPackageObjectUnavailableError,
  ManagedPackageReleaseConflictError,
  ManagedPackageResolutionIntegrityError,
  publishSpaceAppManagedPackage,
  resolveSpaceAppManagedPackage,
  type ManagedPackageRelease,
  type ManagedPackageReleaseStore,
} from "@libs/space-app-registry";
import {
  createSpaceAppManagedPackageArtifact,
  type SpaceAppManagedPackageArtifact,
} from "@vibechat/space-app-dependencies";
import { describe, expect, it } from "vitest";

class MemoryReleaseStore implements ManagedPackageReleaseStore {
  readonly records = new Map<string, ManagedPackageRelease>();

  async find(name: string, version: string) {
    return this.records.get(`${name}@${version}`) ?? null;
  }

  async publish(release: ManagedPackageRelease) {
    const key = `${release.name}@${release.version}`;
    const existing = this.records.get(key);
    if (existing) {
      if (
        existing.integrity !== release.integrity
        || existing.objectKey !== release.objectKey
        || existing.objectHash !== release.objectHash
      ) {
        throw new ManagedPackageReleaseConflictError(release.name, release.version);
      }
      return { release: existing, created: false } as const;
    }
    this.records.set(key, release);
    return { release, created: true } as const;
  }
}

class MemoryObjectStore implements RuntimeObjectStore {
  readonly objects = new Map<string, Uint8Array>();

  async put(content: Uint8Array) {
    const hash = `sha256:${createHash("sha256").update(content).digest("hex")}` as const;
    const objectKey = `space-runtime/objects/${hash.slice(7)}`;
    this.objects.set(objectKey, Uint8Array.from(content));
    return { objectKey, hash };
  }

  async get(objectKey: string) {
    const content = this.objects.get(objectKey);
    return content ? Uint8Array.from(content) : null;
  }
}

function artifact(version: string, implementation = version): SpaceAppManagedPackageArtifact {
  const name = "@vibechat/space-app-components";
  return createSpaceAppManagedPackageArtifact({
    name,
    version,
    projectFormats: ["agentos-app-v1"],
    files: {
      "package.json": JSON.stringify({
        name,
        version,
        type: "module",
        exports: { "./chat": "./chat.js" },
      }),
      "chat.js": `export const implementation = ${JSON.stringify(implementation)};\n`,
    },
  });
}

describe("Space App managed package Registry service", () => {
  it("publishes idempotently and resolves exact historical versions", async () => {
    const releases = new MemoryReleaseStore();
    const objects = new MemoryObjectStore();
    const oldArtifact = artifact("0.7.4");
    const currentArtifact = artifact("0.8.1");

    const first = await publishSpaceAppManagedPackage({
      artifact: oldArtifact,
      releases,
      objects,
    });
    const duplicate = await publishSpaceAppManagedPackage({
      artifact: oldArtifact,
      releases,
      objects,
    });
    await publishSpaceAppManagedPackage({ artifact: currentArtifact, releases, objects });

    expect(first.created).toBe(true);
    expect(duplicate).toEqual({ release: first.release, created: false });
    for (const expected of [oldArtifact, currentArtifact]) {
      await expect(resolveSpaceAppManagedPackage({
        request: {
          name: expected.name,
          version: expected.version,
          integrity: expected.integrity,
          projectFormat: "agentos-app-v1",
        },
        releases,
        objects,
      })).resolves.toEqual(expected);
    }
  });

  it("rejects same-version content drift and missing or tampered objects", async () => {
    const releases = new MemoryReleaseStore();
    const objects = new MemoryObjectStore();
    const expected = artifact("0.8.1");
    const published = await publishSpaceAppManagedPackage({
      artifact: expected,
      releases,
      objects,
    });

    await expect(publishSpaceAppManagedPackage({
      artifact: artifact("0.8.1", "drift"),
      releases,
      objects,
    })).rejects.toBeInstanceOf(ManagedPackageReleaseConflictError);
    expect(objects.objects.size).toBe(1);

    objects.objects.delete(published.release.objectKey);
    await expect(resolveSpaceAppManagedPackage({
      request: {
        name: expected.name,
        version: expected.version,
        integrity: expected.integrity,
        projectFormat: "agentos-app-v1",
      },
      releases,
      objects,
    })).rejects.toBeInstanceOf(ManagedPackageObjectUnavailableError);

    objects.objects.set(
      published.release.objectKey,
      new TextEncoder().encode("tampered\n"),
    );
    await expect(resolveSpaceAppManagedPackage({
      request: {
        name: expected.name,
        version: expected.version,
        integrity: expected.integrity,
        projectFormat: "agentos-app-v1",
      },
      releases,
      objects,
    })).rejects.toBeInstanceOf(ManagedPackageResolutionIntegrityError);
  });
});
