import { describe, expect, it } from "vitest";
import {
  createSpaceAppComponentMigrationPlan,
} from "../../../scripts/plan-space-app-component-migration";
import {
  spaceAppComponentManagedReleaseSchemaVersion,
  type SpaceAppComponentManagedRelease,
} from "../../../packages/space-app-components/src/node";

const release: SpaceAppComponentManagedRelease = {
  schemaVersion: spaceAppComponentManagedReleaseSchemaVersion,
  name: "@vibechat/space-app-components",
  version: "1.2.3",
  integrity: `sha256:${"a".repeat(64)}`,
  packageFormat: "npm-package-v1",
  projectFormats: ["agentos-app-v1"],
  componentBundle: {
    sourceHash: `sha256:${"b".repeat(64)}`,
    artifactHash: `sha256:${"c".repeat(64)}`,
  },
};

describe("Space App component migration planning", () => {
  it("adds the exact dependency and managed integrity without generated paths", () => {
    const plan = createSpaceAppComponentMigrationPlan({
      "package.json": `${JSON.stringify({
        name: "space-example",
        dependencies: { rivetkit: "2.3.9" },
      }, null, 2)}\n`,
    }, release);

    expect(plan).toMatchObject({
      changed: true,
      from: { version: null, integrity: null },
      to: { version: "1.2.3", integrity: release.integrity },
    });
    expect(JSON.parse(plan.files["package.json"])).toMatchObject({
      dependencies: {
        rivetkit: "2.3.9",
        "@vibechat/space-app-components": "1.2.3",
      },
    });
    expect(JSON.parse(plan.files["space-app-dependencies.json"])).toEqual({
      schemaVersion: "vibechat.space-app-dependencies/v1",
      packages: {
        "@vibechat/space-app-components": {
          version: "1.2.3",
          integrity: release.integrity,
        },
      },
    });
    expect(JSON.stringify(plan.files)).not.toMatch(/vendor|artifact|registry/i);
  });

  it("is stable after the generated source files are adopted", () => {
    const first = createSpaceAppComponentMigrationPlan({
      "package.json": '{"name":"space-example"}\n',
    }, release);
    const second = createSpaceAppComponentMigrationPlan(first.files, release);

    expect(second.changed).toBe(false);
    expect(second.files).toEqual(first.files);
  });

  it("fails closed on an unknown dependency-lock schema", () => {
    expect(() => createSpaceAppComponentMigrationPlan({
      "package.json": '{}\n',
      "space-app-dependencies.json": JSON.stringify({
        schemaVersion: "unknown/v9",
        packages: {},
      }),
    }, release)).toThrow(/unsupported schema/);
  });
});
