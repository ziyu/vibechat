import { createHash, randomUUID } from "node:crypto";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createSpaceTemplate,
  createSpaceTemplateMarketEntry,
  createSpaceTemplateVersion,
  getOfficialSpaceTemplateVersion,
  hashSpaceTemplateProjectFiles,
  isOfficialSpaceTemplate,
  officialSpaceTemplates,
  spaceTemplateRequiredProjectPaths,
  type SpaceTemplateManifest,
  type SpaceTemplateVersionManifest,
} from "@vibechat/space-templates";
import { loadOfficialSpaceTemplateArtifact } from "@vibechat/space-templates/node";
import {
  initializeProjectFromTemplate,
  loadProject,
  projectDirectory,
  saveProject,
  StoredProjectIntegrityError,
  validateFiles,
} from "../../../apps/space-runtime/src/project-store";
import { describe, expect, it } from "vitest";

describe("Space Template publication protocol", () => {
  it("loads five official App artifacts from one working source tree per Template", async () => {
    expect(officialSpaceTemplates).toHaveLength(5);
    const currentArtifacts = await Promise.all(officialSpaceTemplates.map(async (template) => {
      const version = getOfficialSpaceTemplateVersion(
        template.id,
        template.currentVersionId,
      );
      const project = await loadOfficialSpaceTemplateArtifact(
        template.id,
        template.currentVersionId,
      );
      expect(template.publisher).toMatchObject({
        id: "publisher-vibechat",
        verification: "official",
      });
      expect(version).toMatchObject({
        id: expect.stringMatching(/^tplv-.+-0-1-0$/),
        semanticVersion: "0.1.0",
        sourceHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        manifestHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        projectFormat: "agentos-app-v1",
        compatibility: {
          spaceAppSdk: "v1",
          runtime: "agentos-apps-0.2",
        },
        provenance: {
          origin: "repository",
          publisherId: "publisher-vibechat",
          sourcePath: expect.stringContaining(
            `packages/space-templates/official/${template.id}/app`,
          ),
        },
        artifact: {
          schemaVersion: "vibechat.space-template-artifact/v1",
          id: expect.stringMatching(/^tpla-[a-f0-9]{64}$/),
          format: "agentos-app-v1",
          sourceHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        },
      });
      expect(project).not.toBeNull();
      expect(version!.sourceHash).toBe(
        hashSpaceTemplateProjectFiles(project!.files),
      );
      expect(version!.artifact.sourceHash).toBe(version!.sourceHash);
      expect(version!.integrity).toContain(
        version!.manifestHash.replace(":", "."),
      );
      expect(Object.keys(project!.files)).toEqual(
        expect.arrayContaining([...spaceTemplateRequiredProjectPaths]),
      );
      expect(Object.keys(project!.files).length).toBeGreaterThanOrEqual(9);
      expect(project!.files["src/index.ts"].length).toBeLessThan(1_000);
      expect(project!.files["src/index.ts"]).toContain("./runtime.js");
      expect(project!.files["src/index.ts"]).toContain("./page.js");
      expect(project!.files["src/index.ts"]).toContain(
        "registry.start()",
      );
      expect(project!.files["src/runtime.ts"]).toContain("setup(");
      expect(project!.files["src/chat/client.ts"]).toContain(
        "/v1/space-app-sdk",
      );
      expect(project!.files["src/chat/client.ts"]).toContain(
        "data-vibechat-default-chat-app",
      );
      expect(isOfficialSpaceTemplate(template)).toBe(true);
      return project!;
    }));

    expect(
      new Set(
        currentArtifacts.map((project) => [
          project.files["src/app/markup.ts"],
          project.files["src/app/styles.ts"],
          project.files["src/app/client.ts"],
        ].join("\n")),
      ).size,
    ).toBe(5);
  });

  it("hashes the complete project tree in stable path order", () => {
    const first = {
      "src/view/palette.ts": "export const accent = '#abc';\n",
      "src/index.ts": "export default function fetch() {}\n",
      "package.json": "{}\n",
      "tsconfig.json": "{}\n",
    };
    const reordered = {
      "tsconfig.json": first["tsconfig.json"],
      "package.json": first["package.json"],
      "src/index.ts": first["src/index.ts"],
      "src/view/palette.ts": first["src/view/palette.ts"],
    };
    expect(hashSpaceTemplateProjectFiles(first)).toBe(
      hashSpaceTemplateProjectFiles(reordered),
    );
    expect(hashSpaceTemplateProjectFiles({
      ...first,
      "src/view/palette.ts": "export const accent = '#def';\n",
    })).not.toBe(hashSpaceTemplateProjectFiles(first));

    const legacyFiles = Object.fromEntries(
      spaceTemplateRequiredProjectPaths.map((path) => [path, first[path]]),
    );
    const legacyCanonical = spaceTemplateRequiredProjectPaths
      .map((path) => `${path.length}:${path}:${first[path].length}:${first[path]}`)
      .join("");
    expect(hashSpaceTemplateProjectFiles(legacyFiles)).toBe(
      `sha256:${createHash("sha256").update(legacyCanonical).digest("hex")}`,
    );
  });

  it("accepts nested source modules and rejects unsafe project paths", () => {
    const project = {
      "package.json": "{}\n",
      "tsconfig.json": "{}\n",
      "src/index.ts": "export default function fetch() {}\n",
      "src/features/chat/view.ts": "export const view = 'chat';\n",
    };
    expect(Object.keys(validateFiles(project))).toEqual(Object.keys(project).sort());
    expect(() => validateFiles({ ...project, "../escape.ts": "" })).toThrow(
      "invalid project path",
    );
    expect(() => validateFiles({ ...project, ".env": "SECRET=value" })).toThrow(
      "invalid project path",
    );
    expect(() => validateFiles({ ...project, "dist/index.js": "" })).toThrow(
      "invalid project path",
    );
  });

  it("creates an App-published user Template with exactly the same protocol", async () => {
    const officialVersion = getOfficialSpaceTemplateVersion(
      "space-default",
      "tplv-space-default-0-1-0",
    )!;
    const officialProject = await loadOfficialSpaceTemplateArtifact(
      "space-default",
      officialVersion.id,
    );
    const versionManifest: SpaceTemplateVersionManifest = {
      schemaVersion: "vibechat.space-template-version/v1",
      id: "tplv-user-garden-0-1-0",
      semanticVersion: "0.1.0",
      projectFormat: "agentos-app-v1",
      compatibility: officialVersion.compatibility,
      capabilities: officialVersion.capabilities,
      provenance: {
        origin: "app",
        publisherId: "user-alice",
        sourceSpaceRevisionId: "revision-space-alice-42",
        buildId: "build-user-garden-1",
      },
    };
    const version = createSpaceTemplateVersion({
      templateId: "template-user-garden",
      manifest: versionManifest,
      project: officialProject!,
    });
    const manifest: SpaceTemplateManifest = {
      schemaVersion: "vibechat.space-template/v1",
      id: "template-user-garden",
      slug: "alice-garden",
      publisher: {
        id: "user-alice",
        displayName: "Alice",
        verification: "unverified",
      },
      currentVersionId: version.id,
      category: "daily",
      name: { en: "Garden", "zh-CN": "花园" },
      summary: { en: "A shared garden.", "zh-CN": "共享花园。" },
      author: "Alice",
      icon: "✿",
      accent: "#4f7956",
      canvas: "#eef4eb",
    };
    const template = createSpaceTemplate(manifest, [version]);
    const marketEntry = createSpaceTemplateMarketEntry(template);

    expect(template).toMatchObject({
      schemaVersion: "vibechat.space-template/v1",
      publisher: { verification: "unverified" },
      versions: [{
        schemaVersion: "vibechat.space-template-version/v1",
        projectFormat: "agentos-app-v1",
        provenance: {
          origin: "app",
          publisherId: "user-alice",
          sourceSpaceRevisionId: "revision-space-alice-42",
        },
        sourceHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        manifestHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      }],
    });
    expect(isOfficialSpaceTemplate(template)).toBe(false);
    expect(marketEntry).toMatchObject({
      schemaVersion: "vibechat.space-template-market-entry/v1",
      id: template.id,
      versionId: version.id,
      publisher: template.publisher,
      provenance: version.provenance,
      artifact: version.artifact,
    });
  });

  it("enforces one ordered SemVer sequence without empty or skipped releases", async () => {
    const officialVersion = getOfficialSpaceTemplateVersion(
      "space-default",
      "tplv-space-default-0-1-0",
    )!;
    const officialProject = await loadOfficialSpaceTemplateArtifact(
      "space-default",
      officialVersion.id,
    );
    const createUserVersion = (
      semanticVersion: string,
      sourceMarker: string | null,
      id = `user-version-${semanticVersion}`,
    ) => createSpaceTemplateVersion({
      templateId: "template-user-ordered",
      manifest: {
        schemaVersion: "vibechat.space-template-version/v1",
        id,
        semanticVersion,
        projectFormat: "agentos-app-v1",
        compatibility: officialVersion.compatibility,
        capabilities: officialVersion.capabilities,
        provenance: {
          origin: "app",
          publisherId: "user-alice",
          sourceSpaceRevisionId: `revision-${id}`,
        },
      },
      project: {
        ...officialProject!,
        files: {
          ...officialProject!.files,
          "src/app/styles.ts": sourceMarker === null
            ? officialProject!.files["src/app/styles.ts"]
            : `${officialProject!.files["src/app/styles.ts"]}\n// ${sourceMarker}\n`,
        },
      },
    });
    const manifestFor = (currentVersionId: string): SpaceTemplateManifest => ({
      schemaVersion: "vibechat.space-template/v1",
      id: "template-user-ordered",
      slug: "ordered",
      publisher: {
        id: "user-alice",
        displayName: "Alice",
        verification: "unverified",
      },
      currentVersionId,
      category: "daily",
      name: { en: "Ordered", "zh-CN": "有序模板" },
      summary: { en: "Ordered releases.", "zh-CN": "有序发布。" },
      author: "Alice",
      icon: "O",
      accent: "#345",
      canvas: "#fff",
    });

    const v010 = createUserVersion("0.1.0", null);
    const v011 = createUserVersion("0.1.1", "compatible fix");
    const v020 = createUserVersion("0.2.0", "compatible feature");
    const v100 = createUserVersion("1.0.0", "production contract");
    expect(
      createSpaceTemplate(manifestFor(v100.id), [v010, v011, v020, v100])
        .currentVersionId,
    ).toBe(v100.id);

    const emptyBump = createUserVersion("0.1.1", null, "empty-bump");
    expect(() => createSpaceTemplate(
      manifestFor(emptyBump.id),
      [v010, emptyBump],
    )).toThrow("has no immutable payload change");

    const skipped = createUserVersion("0.1.2", "skipped patch");
    expect(() => createSpaceTemplate(
      manifestFor(skipped.id),
      [v010, skipped],
    )).toThrow("cannot skip from 0.1.0 to 0.1.2");

    const duplicate = createUserVersion("0.1.0", "duplicate", "duplicate-version");
    expect(() => createSpaceTemplate(
      manifestFor(duplicate.id),
      [v010, duplicate],
    )).toThrow("repeats semanticVersion 0.1.0");

    expect(() => createSpaceTemplate(
      manifestFor(v011.id),
      [v010, v020, v011],
    )).toThrow("versions must be strictly ordered");

    expect(() => createSpaceTemplate(
      manifestFor(v010.id),
      [v010, v011],
    )).toThrow("currentVersionId must reference latest version");

    const wrongStart = createUserVersion("1.0.0", "wrong start", "wrong-start");
    expect(() => createSpaceTemplate(
      manifestFor(wrongStart.id),
      [wrongStart],
    )).toThrow("must start at 0.1.0");

    expect(() => createUserVersion("01.0.0", "invalid")).toThrow(
      "must use canonical major.minor.patch SemVer",
    );
  });

  it("normalizes a legacy built-in version request to the immutable official version", async () => {
    const appId = `template-${randomUUID()}`;
    const path = join(projectDirectory(), `${appId}.json`);
    try {
      expect(getOfficialSpaceTemplateVersion(
        "space-campfire",
        "builtin-space-campfire-v5",
      )?.id).toBe("tplv-space-campfire-0-1-0");
      expect(getOfficialSpaceTemplateVersion(
        "space-campfire",
        "tplv-space-campfire-5-0-0",
      )?.id).toBe("tplv-space-campfire-0-1-0");
      const initialized = await initializeProjectFromTemplate(
        appId,
        "space-campfire",
        "builtin-space-campfire-v4",
      );
      expect(initialized.project.template).toMatchObject({
        id: "space-campfire",
        versionId: "tplv-space-campfire-0-1-0",
        sourceHash: initialized.project.sourceHash,
        projectFormat: "agentos-app-v1",
      });
    } finally {
      await unlink(path).catch(() => undefined);
    }
  });

  it("records source-addressed lineage and never overwrites an edited Space Project", async () => {
    const appId = `template-${randomUUID()}`;
    const path = join(projectDirectory(), `${appId}.json`);
    try {
      const first = await initializeProjectFromTemplate(
        appId,
        "space-campfire",
        "tplv-space-campfire-0-1-0",
      );
      const customized = {
        ...first.project,
        summary: "Agent customized this Project",
        files: {
          ...first.project.files,
          "src/app/styles.ts": `${first.project.files["src/app/styles.ts"]}\n// Agent revision\n`,
        },
        updatedAt: new Date(Date.now() + 1_000).toISOString(),
      };
      await saveProject(customized);
      const repeated = await initializeProjectFromTemplate(
        appId,
        "space-campfire",
        "tplv-space-campfire-0-1-0",
      );
      expect(repeated.created).toBe(false);
      expect(repeated.project.summary).toBe("Agent customized this Project");
      expect(repeated.project.template?.versionId).toBe(
        "tplv-space-campfire-0-1-0",
      );
      expect(repeated.project.files["src/app/styles.ts"]).toContain(
        "// Agent revision",
      );
    } finally {
      await unlink(path).catch(() => undefined);
    }
  });

  it("rejects a stored Project whose files no longer match its source hash", async () => {
    const appId = `template-${randomUUID()}`;
    const path = join(projectDirectory(), `${appId}.json`);
    try {
      await initializeProjectFromTemplate(
        appId,
        "space-default",
        "tplv-space-default-0-1-0",
      );
      const stored = JSON.parse(await readFile(path, "utf8")) as {
        files: Record<string, string>;
      };
      stored.files["src/chat/client.ts"] += "\n// untracked disk mutation\n";
      await writeFile(path, `${JSON.stringify(stored, null, 2)}\n`, "utf8");

      await expect(loadProject(appId)).rejects.toBeInstanceOf(
        StoredProjectIntegrityError,
      );
    } finally {
      await unlink(path).catch(() => undefined);
    }
  });
});
