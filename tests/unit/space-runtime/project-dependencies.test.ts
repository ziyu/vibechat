import { randomUUID } from "node:crypto";
import { createSpaceAppManagedPackageArtifact } from "@vibechat/space-app-dependencies";
import { describe, expect, it, vi } from "vitest";
import { createProjectDependencyPreparer } from "../../../apps/space-runtime/src/project-dependencies";
import {
  loadProject,
  saveProject,
  type ProjectFiles,
} from "../../../apps/space-runtime/src/project-store";

const records = vi.hoisted(() => new Map<string, unknown>());

vi.mock("../../../apps/space-runtime/src/remote-project-store.js", () => ({
  createRemoteProjectStoreFromEnv: () => ({
    async load(appId: string) {
      const project = records.get(appId);
      return project ? structuredClone(project) : null;
    },
    async save(project: { appId: string }) {
      const stored = structuredClone(project);
      records.set(project.appId, stored);
      return structuredClone(stored);
    },
  }),
}));

function managedProject() {
  const name = "@vibechat/space-app-components";
  const artifact = createSpaceAppManagedPackageArtifact({
    name,
    version: "2.0.0",
    projectFormats: ["agentos-app-v1"],
    files: {
      "package.json": JSON.stringify({
        name,
        version: "2.0.0",
        type: "module",
        exports: { ".": "./index.js" },
      }),
      "index.js": "export const version = '2.0.0';\n",
    },
  });
  const files: ProjectFiles = {
    "package.json": JSON.stringify({
      name: "space-project-store-dependencies",
      private: true,
      type: "module",
      dependencies: { [name]: artifact.version },
    }),
    "tsconfig.json": "{}\n",
    "space-app-dependencies.json": JSON.stringify({
      schemaVersion: "vibechat.space-app-dependencies/v1",
      packages: {
        [name]: {
          version: artifact.version,
          integrity: artifact.integrity,
        },
      },
    }),
    "src/index.ts": "export default { fetch() { return new Response('ok') } }\n",
  };
  return { artifact, files };
}

describe("Stored Space Project prepared dependency artifact", () => {
  it("persists and revalidates the exact prepared artifact", async () => {
    const appId = `space-${randomUUID()}`;
    const { artifact, files } = managedProject();
    const prepared = await createProjectDependencyPreparer({
      resolve: async () => artifact,
    })(files);

    await saveProject({
      appId,
      files,
      summary: "Managed dependency ready",
      updatedAt: new Date().toISOString(),
      draftId: prepared.artifactHash.slice(7, 23),
      prepared,
    });
    const loaded = await loadProject(appId);

    expect(loaded?.prepared?.artifactHash).toBe(prepared.artifactHash);
    expect(loaded?.prepared?.files).toEqual(prepared.files);
  });

  it("rejects reusing a prepared artifact after editable source changes", async () => {
    const appId = `space-${randomUUID()}`;
    const { artifact, files } = managedProject();
    const prepared = await createProjectDependencyPreparer({
      resolve: async () => artifact,
    })(files);

    await expect(saveProject({
      appId,
      files: {
        ...files,
        "src/index.ts": `${files["src/index.ts"]}// edited\n`,
      },
      summary: "Stale prepared artifact",
      updatedAt: new Date().toISOString(),
      prepared,
    })).rejects.toMatchObject({
      code: "space_app_prepared_project_integrity_mismatch",
    });
  });

  it("rejects prepared metadata drift when loading stored state", async () => {
    const appId = `space-${randomUUID()}`;
    const { artifact, files } = managedProject();
    const prepared = await createProjectDependencyPreparer({
      resolve: async () => artifact,
    })(files);
    await saveProject({
      appId,
      files,
      summary: "Prepared metadata",
      updatedAt: new Date().toISOString(),
      prepared,
    });
    const stored = records.get(appId) as { prepared: typeof prepared };
    records.set(appId, {
      ...stored,
      prepared: {
        ...stored.prepared,
        importPaths: { "@vibechat/forged": "vendor/forged.js" },
      },
    });

    await expect(loadProject(appId)).rejects.toMatchObject({
      code: "space_app_prepared_project_integrity_mismatch",
    });
  });
});
