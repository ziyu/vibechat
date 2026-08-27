import {
  assertPreparedSpaceAppProject,
  createSpaceAppManagedPackageArtifact,
  hashSpaceAppDependencyFiles,
  prepareSpaceAppProject,
  resolvedSpaceAppDependenciesPath,
  SpaceAppDependencyResolutionError,
  type SpaceAppManagedPackageArtifact,
  type SpaceAppManagedPackageRegistry,
} from "@vibechat/space-app-dependencies";
import { describe, expect, it, vi } from "vitest";

const packageName = "@vibechat/space-app-components";

function sourceProject(dependencies?: Record<string, string>) {
  return {
    "package.json": `${JSON.stringify({
      name: "space-managed-dependency-test",
      private: true,
      type: "module",
      ...(dependencies ? { dependencies } : {}),
    }, null, 2)}\n`,
    "tsconfig.json": "{}\n",
    "src/index.ts": "export default { fetch() { return new Response('ok') } }\n",
  };
}

function managedArtifact() {
  return createSpaceAppManagedPackageArtifact({
    name: packageName,
    version: "1.2.3",
    projectFormats: ["agentos-app-v1"],
    files: {
      "package.json": `${JSON.stringify({
        name: packageName,
        version: "1.2.3",
        type: "module",
        exports: {
          "./chat": {
            types: "./chat/index.d.ts",
            import: "./chat/index.js",
          },
        },
      })}\n`,
      "chat/index.js": "export const chat = 'managed';\n",
      "chat/index.d.ts": "export declare const chat: string;\n",
    },
  });
}

function lockedProject(
  artifact: SpaceAppManagedPackageArtifact,
  overrides: {
    dependencyVersion?: string;
    integrity?: string;
  } = {},
) {
  return {
    ...sourceProject({
      [packageName]: overrides.dependencyVersion ?? artifact.version,
    }),
    "space-app-dependencies.json": `${JSON.stringify({
      schemaVersion: "vibechat.space-app-dependencies/v1",
      packages: {
        [packageName]: {
          version: artifact.version,
          integrity: overrides.integrity ?? artifact.integrity,
        },
      },
    }, null, 2)}\n`,
  };
}

function registry(
  resolve: SpaceAppManagedPackageRegistry["resolve"],
): SpaceAppManagedPackageRegistry {
  return { resolve };
}

describe("Space App managed dependency resolution", () => {
  it("preserves legacy projects without managed dependencies byte-for-byte", async () => {
    const files = sourceProject();
    const resolve = vi.fn();
    const prepared = await prepareSpaceAppProject({
      files,
      registry: registry(resolve),
    });

    expect(prepared.files).toEqual(files);
    expect(prepared.dependencies).toEqual([]);
    expect(prepared.importPaths).toEqual({});
    expect(prepared.artifactHash).toBe(prepared.sourceHash);
    expect(resolve).not.toHaveBeenCalled();
  });

  it("lets an existing legacy Space add an exact managed dependency later", async () => {
    const artifact = managedArtifact();
    const legacy = await prepareSpaceAppProject({
      files: sourceProject(),
      registry: registry(async () => null),
    });
    const source = lockedProject(artifact);
    const prepared = await prepareSpaceAppProject({
      files: source,
      registry: registry(async () => artifact),
    });

    expect(legacy.dependencies).toHaveLength(0);
    expect(prepared.dependencies).toEqual([{
      name: packageName,
      version: "1.2.3",
      integrity: artifact.integrity,
      path: "vendor/vibechat-packages/vibechat/space-app-components",
    }]);
    expect(prepared.importPaths).toEqual({
      [`${packageName}/chat`]:
        "vendor/vibechat-packages/vibechat/space-app-components/chat/index.js",
    });
    expect(JSON.parse(prepared.files["package.json"]).dependencies[packageName])
      .toBe("file:vendor/vibechat-packages/vibechat/space-app-components");
    expect(source["package.json"]).toContain('"1.2.3"');
    expect(prepared.files[resolvedSpaceAppDependenciesPath]).toContain(
      prepared.sourceHash,
    );
  });

  it("is deterministic for the same source and Registry artifact", async () => {
    const artifact = managedArtifact();
    const files = lockedProject(artifact);
    const first = await prepareSpaceAppProject({
      files,
      registry: registry(async () => artifact),
    });
    const second = await prepareSpaceAppProject({
      files: Object.fromEntries(Object.entries(files).reverse()),
      registry: registry(async () => artifact),
    });

    expect(second.sourceHash).toBe(first.sourceHash);
    expect(second.artifactHash).toBe(first.artifactHash);
    expect(second.files).toEqual(first.files);
  });

  it("fails closed when a managed dependency is not locked", async () => {
    await expect(prepareSpaceAppProject({
      files: sourceProject({ [packageName]: "1.2.3" }),
      registry: registry(async () => managedArtifact()),
    })).rejects.toMatchObject({
      code: "space_app_dependency_not_locked",
    });
  });

  it("fails closed on version, availability, integrity, and generated-path drift", async () => {
    const artifact = managedArtifact();
    await expect(prepareSpaceAppProject({
      files: lockedProject(artifact, { dependencyVersion: "1.2.4" }),
      registry: registry(async () => artifact),
    })).rejects.toMatchObject({ code: "space_app_dependency_version_mismatch" });

    await expect(prepareSpaceAppProject({
      files: lockedProject(artifact),
      registry: registry(async () => null),
    })).rejects.toMatchObject({ code: "space_app_dependency_unavailable" });

    await expect(prepareSpaceAppProject({
      files: lockedProject(artifact),
      registry: registry(async () => ({
        ...artifact,
        files: { ...artifact.files, "chat/index.js": "tampered\n" },
      })),
    })).rejects.toMatchObject({ code: "space_app_dependency_integrity_mismatch" });

    await expect(prepareSpaceAppProject({
      files: {
        ...lockedProject(artifact),
        "vendor/vibechat-packages/owned.txt": "source collision\n",
      },
      registry: registry(async () => artifact),
    })).rejects.toMatchObject({
      code: "space_app_dependency_generated_path_collision",
    });
  });

  it("rejects a cached prepared artifact whose metadata was altered", async () => {
    const artifact = managedArtifact();
    const files = lockedProject(artifact);
    const prepared = await prepareSpaceAppProject({
      files,
      registry: registry(async () => artifact),
    });

    expect(() => assertPreparedSpaceAppProject(files, {
      ...prepared,
      importPaths: {
        ...prepared.importPaths,
        [packageName]: "vendor/forged.js",
      },
    })).toThrow(SpaceAppDependencyResolutionError);

    const tamperedFiles = {
      ...prepared.files,
      "package.json": `${JSON.stringify({
        ...JSON.parse(prepared.files["package.json"]),
        scripts: { postinstall: "forged" },
      }, null, 2)}\n`,
    };
    expect(() => assertPreparedSpaceAppProject(files, {
      ...prepared,
      files: tamperedFiles,
      artifactHash: hashSpaceAppDependencyFiles(tamperedFiles),
    })).toThrow("package.json does not match");
  });
});
