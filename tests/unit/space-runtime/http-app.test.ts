import { describe, expect, it, vi } from "vitest";
import {
  signSpaceRuntimeCredential,
  spaceRuntimeAudience,
} from "../../../packages/space-runtime-auth/src/index";
import { createFakeAgentAdapter } from "../../../apps/space-runtime/src/adapters/fake/adapter";
import { SpaceAgentAdapterRegistry } from "../../../apps/space-runtime/src/adapters/registry";
import { createHttpApp } from "../../../apps/space-runtime/src/composition/create-http-app";
import type { SpaceRuntimeDependencies } from "../../../apps/space-runtime/src/composition/dependencies";
import { createSpaceRuntimeConfig } from "../../../apps/space-runtime/src/composition/runtime-config";

const signingSecret = "test-space-runtime-signing-secret-32";

describe("Space Runtime HTTP composition", () => {
  it("protects product and Runtime routes with the internal credential", async () => {
    const { runtime } = createRuntimeStub();
    const response = await createHttpApp(runtime).request(
      "/api/apps/space-1/messages",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "hello", matrixEventId: "event-1" }),
      },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
  });

  it("routes a valid message request through the provider-neutral registry", async () => {
    const path = "/api/apps/space-1/messages";
    const credential = await runtimeCredential("POST", path);
    const { runtime, beginTurn } = createRuntimeStub();
    const response = await createHttpApp(runtime).request(path, {
      method: "POST",
      headers: {
        authorization: `Bearer ${credential}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message: "hello",
        matrixEventId: "event-1",
        clientId: "member-1",
        authorName: "Alice",
        agentId: "fake",
      }),
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      accepted: true,
      turnId: "turn-1",
      deduplicated: false,
    });
    expect(beginTurn).toHaveBeenCalledWith("space-1", {
      clientId: "member-1",
      authorName: "Alice",
      text: "hello",
      kind: "message",
      externalRequestId: "event-1",
      agentId: "fake",
    });
  });

  it("keeps template bootstrap idempotency behind the composition service", async () => {
    const path = "/api/apps/space-1/bootstrap";
    const credential = await runtimeCredential("POST", path);
    const { runtime, bootstrapTemplateProject } = createRuntimeStub();
    const response = await createHttpApp(runtime).request(path, {
      method: "POST",
      headers: {
        authorization: `Bearer ${credential}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        templateId: "space-default",
        templateVersionId: "v1",
      }),
    });

    expect(response.status).toBe(200);
    expect(bootstrapTemplateProject).toHaveBeenCalledWith(
      "space-1",
      "space-default",
      "v1",
    );
  });
});

function createRuntimeStub() {
  const beginTurn = vi.fn(async () => ({
    turnId: "turn-1",
    deduplicated: false,
  }));
  const bootstrapTemplateProject = vi.fn(async () => ({
    created: false,
    project: {
      appId: "space-1",
      files: {},
      sourceHash: `sha256:${"a".repeat(64)}` as const,
      summary: "Existing",
      updatedAt: "2026-08-26T00:00:00.000Z",
    },
    devPreview: { state: "idle" as const },
  }));
  const runtime = {
    config: createSpaceRuntimeConfig({
      SPACE_RUNTIME_INTERNAL_TOKEN: signingSecret,
      RIVET_ENDPOINT: "http://127.0.0.1:6420",
    }),
    durableSpaceControl: { description: "test-control" },
    agentAdapters: new SpaceAgentAdapterRegistry([
      createFakeAgentAdapter(),
    ]),
    devPreviews: {},
    spaces: { beginTurn },
    bootstrapTemplateProject,
  } as unknown as SpaceRuntimeDependencies;
  return { runtime, beginTurn, bootstrapTemplateProject };
}

async function runtimeCredential(method: string, path: string) {
  return signSpaceRuntimeCredential({
    secret: signingSecret,
    audience: spaceRuntimeAudience,
    subject: "vibechat-backend",
    method,
    path,
    ttlSeconds: 30,
    credentialId: `test-${method}-${path}`,
  });
}
