import { createHash, randomUUID } from "node:crypto";
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
  createProjectFromTemplate,
  initializeProjectFromTemplate,
  loadProject,
  saveProject,
  StoredProjectIntegrityError,
  validateFiles,
} from "../../../apps/space-runtime/src/project-store";
import { describe, expect, it, vi } from "vitest";

const projectRecords = vi.hoisted(() => new Map<string, unknown>());

vi.mock("../../../apps/space-runtime/src/remote-project-store.js", () => ({
  createRemoteProjectStoreFromEnv: () => ({
    async load(appId: string) {
      const project = projectRecords.get(appId);
      return project ? structuredClone(project) : null;
    },
    async save(project: { appId: string }) {
      const stored = structuredClone(project);
      projectRecords.set(project.appId, stored);
      return structuredClone(stored);
    },
  }),
}));

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
      const expectedCurrentVersion = template.id === "space-default"
        ? "0.1.5"
        : template.id === "space-focus"
          ? "0.1.3"
          : "0.1.2";
      expect(template.versions.map((item) => item.semanticVersion)).toEqual(
        template.id === "space-default"
          ? ["0.1.0", "0.1.1", "0.1.2", "0.1.3", "0.1.4", "0.1.5"]
          : template.id === "space-focus"
            ? ["0.1.0", "0.1.1", "0.1.2", "0.1.3"]
            : ["0.1.0", "0.1.1", "0.1.2"],
      );
      expect(version).toMatchObject({
        id: expect.stringMatching(
          new RegExp(`^tplv-.+-${expectedCurrentVersion.replaceAll(".", "-")}$`),
        ),
        semanticVersion: expectedCurrentVersion,
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
      expect(Object.keys(project!.files).length).toBeGreaterThanOrEqual(
        template.id === "space-default" || template.id === "space-focus"
          ? 20
          : 24,
      );
      expect(project!.files["src/index.ts"].length).toBeLessThan(1_000);
      expect(project!.files["src/index.ts"]).toContain("./runtime.js");
      expect(project!.files["src/index.ts"]).toContain("./page.js");
      expect(project!.files["src/index.ts"]).toContain(
        "registry.start()",
      );
      expect(project!.files["src/index.ts"]).toContain(
        'export { registry } from "./runtime.js"',
      );
      expect(project!.files["src/runtime.ts"]).toContain("setup(");
      expect(project!.files["src/chat/client.ts"]).toContain(
        "/v1/space-app-sdk",
      );
      expect(project!.files["src/chat/client.ts"]).toContain(
        "data-vibechat-default-chat-app",
      );
      expect(project!.files["src/chat/client.ts"].length).toBeLessThan(3_000);
      expect(project!.files["src/chat/client.ts"]).toContain(
        './client/bootstrap.js',
      );
      expect(project!.files["src/chat/styles.ts"]).toContain(
        './styles/composer.js',
      );
      expect(project!.files["src/chat/styles/foundation.ts"]).toContain(
        '.vcc-root[data-mode="full"] .vcc-head',
      );
      expect(project!.files["src/chat/styles/composer.ts"]).toContain(
        ".vcc-compose-wrap {\n  position: relative;",
      );
      const markup = project!.files["src/chat/markup.ts"];
      if (template.id === "space-default" || template.id === "space-focus") {
        expect(project!.files["src/chat/client/bootstrap.ts"]).toContain(
          "createSpaceChatController",
        );
        expect(project!.files["src/chat/client/bootstrap.ts"]).toContain(
          "spaceChatEventNames",
        );
        expect(project!.files["src/chat/client.ts"]).toContain(
          'from "@vibechat/space-app-components/chat/inline"',
        );
        expect(JSON.parse(project!.files["package.json"]).dependencies)
          .toMatchObject({ "@vibechat/space-app-components": "0.7.0" });
        expect(JSON.parse(
          project!.files["space-app-dependencies.json"],
        ).packages["@vibechat/space-app-components"]).toEqual({
          version: "0.7.0",
          integrity: "sha256:7640548144e75ce7305d893c26e43f2ae14d1c6adefdd099cd58af80d54e3103",
        });
        expect(project!.files["src/vendor/space-app-components-chat.ts"])
          .toBeUndefined();
        expect(project!.files["src/chat/client/composer.ts"]).toBeUndefined();
        expect(project!.files["src/chat/client/messages.ts"]).toBeUndefined();
        expect(Object.entries(project!.files)
          .filter(([path]) => path.startsWith("src/chat/"))
          .map(([, source]) => source)
          .join("\n")).not.toContain(
          "innerHTML",
        );
        expect(markup.indexOf('id="vcc-timeline"')).toBeLessThan(
          markup.indexOf('id="vcc-composer"'),
        );
        if (template.id === "space-focus") {
          expect(project!.files["src/chat/client.ts"]).toContain(
            'bootstrapChat(space, components, "dock")',
          );
          expect(project!.files["src/app/controller.ts"]).toContain(
            'space.state.get<unknown>("studio.notes")',
          );
        }
      } else {
        expect(project!.files["src/chat/client/composer.ts"]).toContain(
          "submitChatMessage",
        );
        expect(project!.files["src/chat/client/messages.ts"]).toContain(
          "renderMessageHtml",
        );
        expect(markup.indexOf('id="vcc-attach"')).toBeLessThan(
          markup.indexOf('id="vcc-input"'),
        );
        expect(markup.indexOf('id="vcc-input"')).toBeLessThan(
          markup.indexOf('id="vcc-send"'),
        );
        expect(project!.files["src/app/controller.ts"]).toBeTruthy();
      }
      if (template.id !== "space-default") {
        expect(project!.files["src/app/controller.ts"]).toBeTruthy();
      }
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
      "tplv-space-default-0-1-5",
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
      "tplv-space-default-0-1-5",
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
    try {
      expect(getOfficialSpaceTemplateVersion(
        "space-campfire",
        "builtin-space-campfire-v5",
      )?.id).toBe("tplv-space-campfire-0-1-2");
      expect(getOfficialSpaceTemplateVersion(
        "space-campfire",
        "tplv-space-campfire-5-0-0",
      )?.id).toBe("tplv-space-campfire-0-1-2");
      const initialized = await initializeProjectFromTemplate(
        appId,
        "space-campfire",
        "builtin-space-campfire-v4",
      );
      expect(initialized.project.template).toMatchObject({
        id: "space-campfire",
        versionId: "tplv-space-campfire-0-1-2",
        sourceHash: initialized.project.sourceHash,
        projectFormat: "agentos-app-v1",
      });
    } finally {
      projectRecords.delete(appId);
    }
  });

  it("records source-addressed lineage and never overwrites an edited Space Project", async () => {
    const appId = `template-${randomUUID()}`;
    try {
      const first = await initializeProjectFromTemplate(
        appId,
        "space-campfire",
        "tplv-space-campfire-0-1-2",
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
        "tplv-space-campfire-0-1-2",
      );
      expect(repeated.created).toBe(false);
      expect(repeated.project.summary).toBe("Agent customized this Project");
      expect(repeated.project.template?.versionId).toBe(
        "tplv-space-campfire-0-1-2",
      );
      expect(repeated.project.files["src/app/styles.ts"]).toContain(
        "// Agent revision",
      );
    } finally {
      projectRecords.delete(appId);
    }
  });

  it("materializes a recovery Candidate without replacing the current ready Project", async () => {
    const appId = `template-${randomUUID()}`;
    try {
      const first = await initializeProjectFromTemplate(
        appId,
        "space-campfire",
        "tplv-space-campfire-0-1-2",
      );
      const customized = await saveProject({
        ...first.project,
        files: {
          ...first.project.files,
          "src/app/styles.ts": `${first.project.files["src/app/styles.ts"]}\n// current ready revision\n`,
        },
        summary: "Current ready custom App",
        draftId: "0123456789abcdef",
        publishedDraftId: "fedcba9876543210",
        releaseId: "release-1",
        updatedAt: new Date(Date.now() + 1_000).toISOString(),
      });

      const candidate = await createProjectFromTemplate(
        appId,
        "space-default",
        "tplv-space-default-0-1-5",
      );
      const stillReady = await loadProject(appId);

      expect(candidate.template).toMatchObject({
        id: "space-default",
        versionId: "tplv-space-default-0-1-5",
      });
      expect(candidate.files["src/chat/client/bootstrap.ts"]).toContain(
        "createSpaceChatController",
      );
      expect(candidate.files["src/chat/client.ts"]).toContain(
        "@vibechat/space-app-components/chat/inline",
      );
      expect(candidate.files["space-app-dependencies.json"]).toContain(
        "sha256:7640548144e75ce7305d893c26e43f2ae14d1c6adefdd099cd58af80d54e3103",
      );
      expect(candidate.files["src/vendor/space-app-components-chat.ts"])
        .toBeUndefined();
      expect(stillReady).toMatchObject({
        sourceHash: customized.sourceHash,
        summary: "Current ready custom App",
        draftId: "0123456789abcdef",
        publishedDraftId: "fedcba9876543210",
        releaseId: "release-1",
      });
      expect(stillReady?.files["src/app/styles.ts"]).toContain("// current ready revision");
    } finally {
      projectRecords.delete(appId);
    }
  });

  it("rejects a stored Project whose files no longer match its source hash", async () => {
    const appId = `template-${randomUUID()}`;
    try {
      await initializeProjectFromTemplate(
        appId,
        "space-default",
        "tplv-space-default-0-1-5",
      );
      const stored = structuredClone(projectRecords.get(appId)) as {
        files: Record<string, string>;
      };
      stored.files["src/chat/client.ts"] += "\n// untracked disk mutation\n";
      projectRecords.set(appId, stored);

      await expect(loadProject(appId)).rejects.toBeInstanceOf(
        StoredProjectIntegrityError,
      );
    } finally {
      projectRecords.delete(appId);
    }
  });
});
