import {
  createSpaceAppManagedPackageArtifact,
  serializeSpaceAppManagedPackageObject,
} from "@vibechat/space-app-dependencies";
import {
  verifySpaceRuntimeCredential,
  spaceBackendCallbackAudience,
} from "@vibechat/space-runtime-auth";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDefaultSpaceAppManagedPackageRegistry,
} from "../../../apps/space-runtime/src/project-dependencies";
import {
  createRemoteSpaceAppManagedPackageRegistryFromEnv,
  RemoteManagedPackageRegistryError,
} from "../../../apps/space-runtime/src/remote-managed-package-registry";

const originalOrigin = process.env.SPACE_RUNTIME_CALLBACK_ORIGIN;
const originalToken = process.env.SPACE_RUNTIME_INTERNAL_TOKEN;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalOrigin === undefined) delete process.env.SPACE_RUNTIME_CALLBACK_ORIGIN;
  else process.env.SPACE_RUNTIME_CALLBACK_ORIGIN = originalOrigin;
  if (originalToken === undefined) delete process.env.SPACE_RUNTIME_INTERNAL_TOKEN;
  else process.env.SPACE_RUNTIME_INTERNAL_TOKEN = originalToken;
});

function artifact(version: string) {
  const name = "@vibechat/space-app-components";
  return createSpaceAppManagedPackageArtifact({
    name,
    version,
    projectFormats: ["agentos-app-v1"],
    files: {
      "package.json": JSON.stringify({ name, version, exports: { ".": "./index.js" } }),
      "index.js": `export const version = ${JSON.stringify(version)};\n`,
    },
  });
}

describe("Runtime remote managed package Registry", () => {
  it("resolves exact versions without a workspace or dist package", async () => {
    process.env.SPACE_RUNTIME_CALLBACK_ORIGIN = "https://backend.test";
    process.env.SPACE_RUNTIME_INTERNAL_TOKEN = "r".repeat(64);
    const artifacts = new Map([
      ["0.7.4", artifact("0.7.4")],
      ["0.8.1", artifact("0.8.1")],
    ]);
    vi.stubGlobal("fetch", vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = new URL(typeof input === "string" || input instanceof URL
        ? input
        : input.url);
      expect(url.pathname).toBe("/v1/internal/space-app-managed-packages");
      const credential = new Headers(init?.headers).get("authorization")?.slice(7) ?? "";
      await expect(verifySpaceRuntimeCredential(credential, {
        secret: process.env.SPACE_RUNTIME_INTERNAL_TOKEN!,
        audience: spaceBackendCallbackAudience,
        subject: "space-runtime",
        method: "POST",
        path: url.pathname,
      })).resolves.toBeTruthy();
      const request = JSON.parse(String(init?.body));
      const expected = artifacts.get(request.version);
      return expected
        ? new Response(serializeSpaceAppManagedPackageObject(expected))
        : Response.json({ error: "managed_package_not_found" }, { status: 404 });
    }));

    const registry = createRemoteSpaceAppManagedPackageRegistryFromEnv();
    for (const expected of artifacts.values()) {
      await expect(registry.resolve({
        name: expected.name,
        version: expected.version,
        integrity: expected.integrity,
        projectFormat: "agentos-app-v1",
      })).resolves.toEqual(expected);
    }
  });

  it("fails closed on Registry and response drift", async () => {
    process.env.SPACE_RUNTIME_CALLBACK_ORIGIN = "https://backend.test";
    process.env.SPACE_RUNTIME_INTERNAL_TOKEN = "r".repeat(64);
    const expected = artifact("0.8.1");
    const registry = createRemoteSpaceAppManagedPackageRegistryFromEnv();

    vi.stubGlobal("fetch", vi.fn(async () => Response.json(
      { error: "integrity_mismatch" },
      { status: 409 },
    )));
    await expect(registry.resolve({
      name: expected.name,
      version: expected.version,
      integrity: expected.integrity,
      projectFormat: "agentos-app-v1",
    })).rejects.toBeInstanceOf(RemoteManagedPackageRegistryError);

    vi.stubGlobal("fetch", vi.fn(async () => new Response("not an artifact")));
    await expect(registry.resolve({
      name: expected.name,
      version: expected.version,
      integrity: expected.integrity,
      projectFormat: "agentos-app-v1",
    })).rejects.toBeInstanceOf(RemoteManagedPackageRegistryError);
  });

  it("does not fall back to the workspace package in production", async () => {
    process.env.SPACE_RUNTIME_CALLBACK_ORIGIN = "https://backend.test";
    process.env.SPACE_RUNTIME_INTERNAL_TOKEN = "r".repeat(64);
    const expected = artifact("0.8.1");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(
      { error: "managed_package_not_found" },
      { status: 404 },
    )));

    await expect(createDefaultSpaceAppManagedPackageRegistry("production").resolve({
      name: expected.name,
      version: expected.version,
      integrity: expected.integrity,
      projectFormat: "agentos-app-v1",
    })).resolves.toBeNull();
  });
});
