import { createHash, randomUUID } from "node:crypto";
import {
  createSpaceAppManagedPackageArtifact,
  prepareSpaceAppProject,
} from "@vibechat/space-app-dependencies";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRemoteProjectStoreFromEnv } from "../../../apps/space-runtime/src/remote-project-store";
import type { StoredProject } from "../../../apps/space-runtime/src/project-store";

const originalOrigin = process.env.SPACE_RUNTIME_CALLBACK_ORIGIN;
const originalToken = process.env.SPACE_RUNTIME_INTERNAL_TOKEN;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalOrigin === undefined) delete process.env.SPACE_RUNTIME_CALLBACK_ORIGIN;
  else process.env.SPACE_RUNTIME_CALLBACK_ORIGIN = originalOrigin;
  if (originalToken === undefined) delete process.env.SPACE_RUNTIME_INTERNAL_TOKEN;
  else process.env.SPACE_RUNTIME_INTERNAL_TOKEN = originalToken;
});

async function storedProject(): Promise<StoredProject> {
  const name = "@vibechat/space-app-components";
  const artifact = createSpaceAppManagedPackageArtifact({
    name,
    version: "3.0.0",
    projectFormats: ["agentos-app-v1"],
    files: {
      "package.json": JSON.stringify({
        name,
        version: "3.0.0",
        type: "module",
        exports: { ".": "./index.js" },
      }),
      "index.js": "export const managed = true;\n",
    },
  });
  const files = {
    "package.json": JSON.stringify({
      name: "space-remote-store-test",
      private: true,
      type: "module",
      dependencies: { [name]: artifact.version },
    }),
    "tsconfig.json": "{}\n",
    "space-app-dependencies.json": JSON.stringify({
      schemaVersion: "vibechat.space-app-dependencies/v1",
      packages: {
        [name]: { version: artifact.version, integrity: artifact.integrity },
      },
    }),
    "src/index.ts": "export default { fetch() { return new Response('ok') } }\n",
  };
  const prepared = await prepareSpaceAppProject({
    files,
    registry: { resolve: async () => artifact },
  });
  return {
    appId: `space-${randomUUID()}`,
    files,
    sourceHash: prepared.sourceHash,
    summary: "Remote prepared artifact",
    updatedAt: new Date().toISOString(),
    draftId: prepared.artifactHash.slice(7, 23),
    prepared,
  };
}

describe("Backend remote Project prepared artifact storage", () => {
  it("stores source and prepared dependency artifact under separate immutable pointers", async () => {
    process.env.SPACE_RUNTIME_CALLBACK_ORIGIN = "https://backend.test";
    process.env.SPACE_RUNTIME_INTERNAL_TOKEN = "s".repeat(64);
    const objects = new Map<string, string>();
    let pointer: Record<string, unknown> | null = null;
    vi.stubGlobal("fetch", vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = new URL(typeof input === "string" || input instanceof URL
        ? input
        : input.url);
      if (url.pathname === "/v1/internal/space-runtime-control") {
        const body = JSON.parse(String(init?.body ?? "{}"));
        if (body.action === "load_project") {
          return Response.json({ projectId: "project-1", project: pointer });
        }
        if (body.action === "claim_lease") {
          return Response.json({
            lease: {
              spaceInstanceId: body.spaceInstanceId,
              ownerId: body.ownerId,
              fencingToken: 1,
              expiresAt: new Date(Date.now() + 30_000).toISOString(),
            },
          });
        }
        if (body.action === "save_project") {
          pointer = {
            ...body.project,
            fencingToken: 1,
            updatedAt: new Date().toISOString(),
          };
          return Response.json({ project: pointer });
        }
      }
      const objectMatch = /^\/v1\/internal\/space-runtime-objects\/([a-f0-9]{64})$/
        .exec(url.pathname);
      if (objectMatch && init?.method === "PUT") {
        const content = new TextDecoder().decode(init.body as Uint8Array);
        const actual = createHash("sha256").update(content).digest("hex");
        expect(actual).toBe(objectMatch[1]);
        objects.set(actual, content);
        return Response.json({
          objectKey: `space-runtime/objects/${actual}`,
          hash: `sha256:${actual}`,
        }, { status: 201 });
      }
      if (objectMatch && init?.method === "GET") {
        const content = objects.get(objectMatch[1]);
        return content === undefined
          ? Response.json({ error: "not_found" }, { status: 404 })
          : new Response(content);
      }
      return Response.json({ error: "unexpected_request" }, { status: 500 });
    }));

    const expected = await storedProject();
    const store = createRemoteProjectStoreFromEnv();
    await store.save(expected);

    expect(pointer?.sourceObjectKey).not.toBe(pointer?.artifactObjectKey);
    expect(pointer?.artifactHash).toBe(expected.prepared?.artifactHash);
    const sourceHash = String(pointer?.sourceObjectKey).split("/").at(-1)!;
    expect(JSON.parse(objects.get(sourceHash) ?? "null").prepared).toBeUndefined();

    const loaded = await store.load(expected.appId);
    expect(loaded).toEqual(expected);
  });
});
