import { describe, expect, it } from "vitest";

import {
  assertSpaceComponentBundle,
  createSpaceAppComponentManagedRegistry,
  createSpaceComponentBundle,
  getCurrentSpaceAppComponentManagedRelease,
  materializeSpaceComponentBundle,
  SpaceComponentBundleIntegrityError,
} from "@vibechat/space-app-components/node";
import { createSpaceAppManagedPackageArtifact } from "@vibechat/space-app-dependencies";
import { renderSpaceComponentCatalogDocument } from "@vibechat/space-app-components/testing";
import { hashSpaceTemplateProjectFiles } from "@vibechat/space-templates";
import { validateFiles } from "../../../apps/space-runtime/src/project-store";

function bundle() {
  return createSpaceComponentBundle({
    packageVersion: "0.1.0",
    sdkRange: "v1",
    projectFormats: ["agentos-app-v1"],
    exports: ["browser.js"],
    cssTokenVersion: "0.1.0",
    sourceFiles: { "src/browser.ts": "export const phase = 0;\n" },
    artifactFiles: {
      "browser.js": "export const phase=0;\n",
    },
  });
}

describe("Space component bundle", () => {
  it("binds exact source and artifact hashes to a deterministic manifest", () => {
    const first = bundle();
    const second = bundle();
    expect(first.manifest).toEqual(second.manifest);
    expect(first.manifest.schemaVersion)
      .toBe("vibechat.space-component-bundle/v1");
    expect(first.manifest.artifactHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(() => assertSpaceComponentBundle(first)).not.toThrow();
  });

  it("fails closed when artifact content drifts", () => {
    const original = bundle();
    const tampered = {
      manifest: original.manifest,
      files: { "browser.js": `${original.files["browser.js"]}// drift\n` },
    };
    expect(() => assertSpaceComponentBundle(tampered))
      .toThrow(SpaceComponentBundleIntegrityError);
  });

  it("materializes as ordinary Project files covered by the Project hash", () => {
    const componentFiles = materializeSpaceComponentBundle(bundle());
    const project = validateFiles({
      "package.json": "{}\n",
      "tsconfig.json": "{}\n",
      "src/index.ts": "export default function fetch() { return new Response('ok') }\n",
      ...componentFiles,
    });
    const baselineHash = hashSpaceTemplateProjectFiles({
      "package.json": project["package.json"],
      "tsconfig.json": project["tsconfig.json"],
      "src/index.ts": project["src/index.ts"],
    });
    expect(hashSpaceTemplateProjectFiles(project)).not.toBe(baselineHash);
    expect(project["src/vendor/vibechat-space-components/manifest.json"])
      .toContain(bundle().manifest.artifactHash);
  });

  it("renders an offline catalog pinned to the same artifact", () => {
    const current = bundle();
    const html = renderSpaceComponentCatalogDocument({ bundle: current });
    expect(html).toContain(current.manifest.artifactHash);
    expect(html).toContain("<vc-space-user-info-card");
    expect(html).toContain("<vc-space-agent-card");
    expect(html).toContain("<vc-space-chat-message");
    expect(html).toContain("<vc-space-typing-indicator");
    expect(html).toContain("theme-signal");
    expect(html).toContain("theme-field");
    expect(html).not.toMatch(/\bhttps?:\/\//);
    expect(html).not.toContain("/v1/space-app-sdk");
  });

  it("serves a publishable component package through the injected managed Registry", async () => {
    const release = getCurrentSpaceAppComponentManagedRelease();
    const artifact = createSpaceAppManagedPackageArtifact({
      name: release.name,
      version: release.version,
      projectFormats: ["agentos-app-v1"],
      files: {
        "package.json": JSON.stringify({
          name: release.name,
          version: release.version,
          type: "module",
          exports: {
            "./chat": "./chat/index.js",
            "./chat/inline": "./chat/inline.js",
          },
        }),
        "chat/index.js": "export const chat = 'semantic';\n",
        "chat/inline.js": "export const spaceChatInlineModule = {};\n",
      },
    });
    const resolved = await createSpaceAppComponentManagedRegistry(
      async () => artifact,
    ).resolve({
      name: release.name,
      version: release.version,
      integrity: artifact.integrity,
      projectFormat: "agentos-app-v1",
    });

    expect(release.version).toBe("0.7.0");
    expect(release.packageFormat).toBe("npm-package-v1");
    expect(resolved?.files["chat/inline.js"]).toContain(
      "spaceChatInlineModule",
    );
  });
});
