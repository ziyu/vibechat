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
import { defaultPiDefinition } from "../../../libs/space-agents/bootstrap";

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

  it("accepts a versioned Agent Turn snapshot with a Backend-generated Turn ID", async () => {
    const path = "/api/apps/space-1/messages";
    const credential = await runtimeCredential("POST", path);
    const { runtime, beginTurn } = createRuntimeStub();
    const agentTurn = createAgentTurn();
    const response = await createHttpApp(runtime).request(path, {
      method: "POST",
      headers: {
        authorization: `Bearer ${credential}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        turnId: agentTurn.turnId,
        message: agentTurn.requestText,
        matrixEventId: "event-pinned-1",
        clientId: "member-1",
        authorName: "Alice",
        agentId: "fake",
        agentTurn,
      }),
    });

    expect(response.status).toBe(202);
    expect(beginTurn).toHaveBeenCalledWith("space-1", expect.objectContaining({
      turnId: "turn-pinned-1",
      externalRequestId: "event-pinned-1",
      agentId: "fake",
      agentTurn,
    }));
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

  it("queues a fixed Space Template replacement through the existing Restore turn", async () => {
    const path = "/api/apps/space-1/restore";
    const credential = await runtimeCredential("POST", path);
    const { runtime, beginTurn } = createRuntimeStub();
    const response = await createHttpApp(runtime).request(path, {
      method: "POST",
      headers: {
        authorization: `Bearer ${credential}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        requestId: "apply-template-request-1",
        target: "template",
        expectedReadyRevisionId: "0123456789abcdef",
        templateId: "space-campfire",
        templateVersionId: "tplv-space-campfire-0-1-2",
        clientId: "member-1",
        authorName: "Alice",
      }),
    });

    expect(response.status).toBe(202);
    expect(beginTurn).toHaveBeenCalledWith("space-1", {
      clientId: "member-1",
      authorName: "Alice",
      text: "应用 Space Template",
      kind: "restore",
      externalRequestId: "apply-template-request-1",
      agentId: "kernel",
      recovery: {
        target: "template",
        expectedReadyRevisionId: "0123456789abcdef",
        templateId: "space-campfire",
        templateVersionId: "tplv-space-campfire-0-1-2",
      },
    });
  });

  it("rejects a Template replacement without a fixed Template Version", async () => {
    const path = "/api/apps/space-1/restore";
    const credential = await runtimeCredential("POST", path);
    const { runtime, beginTurn } = createRuntimeStub();
    const response = await createHttpApp(runtime).request(path, {
      method: "POST",
      headers: {
        authorization: `Bearer ${credential}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        requestId: "apply-template-request-1",
        target: "template",
        expectedReadyRevisionId: "0123456789abcdef",
        templateId: "space-campfire",
        clientId: "member-1",
        authorName: "Alice",
      }),
    });

    expect(response.status).toBe(400);
    expect(beginTurn).not.toHaveBeenCalled();
  });

  it("reports external Engine, replica, region, and declared pool boundaries", async () => {
    vi.stubEnv("PI_MODE", "agentos");
    vi.stubEnv("SPACE_RUNTIME_ENGINE_MODE", "external");
    vi.stubEnv("SPACE_RUNTIME_POOL_WORKLOAD", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ runtime: "engine", status: "ok", version: "2.3.7" }),
      ),
    );
    try {
      const { runtime } = createRuntimeStub();
      const response = await createHttpApp(runtime).request("/api/health");
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        ok: true,
        modelConfigured: true,
        provider: "openai",
        rivetEngineDataDirectory: null,
        deployment: {
          engineMode: "external",
          engineOwnership: "external",
          engineIdentity: "http://127.0.0.1:6420",
          region: "local",
          executionPools: {
            agentExecution: "agent-execution",
            appBuild: "app-build",
            releaseServing: "release-serving",
          },
          poolPolicies: {
            agentExecution: {
              credentialScope: "agent-provider",
              credentialEnvironmentVariableCount: 12,
              egress: { mode: "allow", patternCount: 0 },
            },
            appBuild: {
              credentialScope: "build-without-provider-credentials",
              credentialEnvironmentVariableCount: 0,
            },
            releaseServing: {
              credentialScope: "app-scoped-serving-capability",
              credentialEnvironmentVariableCount: 0,
            },
          },
          poolRoutingEnforced: true,
        },
      });
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
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

function createAgentTurn() {
  return {
    schemaVersion: "vibechat.agent-turn-input/v1" as const,
    turnId: "turn-pinned-1",
    spaceInstanceId: "space-1",
    agentId: "fake",
    sessionId: "session-fake-1",
    sessionGeneration: 1,
    definition: {
      ...defaultPiDefinition,
      definitionId: "agent-definition-fake-v1",
      agentId: "fake",
      adapterKey: "fake",
      adapterVersion: "1.0.0",
      provider: "fake",
      model: "fake",
      displayName: "Fake",
    },
    policy: {
      schemaVersion: "vibechat.agent-policy/v1" as const,
      policySnapshotHash: `sha256:${"b".repeat(64)}`,
      permissionPolicyId: "permissions-default",
      toolPolicyId: "tools-default",
      pricingPolicyId: "pricing-default",
      maxCredits: 10,
      maxInputTokens: 1_000,
      maxOutputTokens: 500,
      allowedTools: [],
    },
    context: {
      matrixEventIds: ["event-pinned-1"],
      messageWindowRef: null,
      summaryRef: null,
    },
    project: {
      projectId: "project-1",
      revisionId: "revision-1",
      sourceHash: `sha256:${"a".repeat(64)}`,
    },
    requestText: "Build a scoreboard",
    requestedAt: "2026-08-27T00:00:00.000Z",
  };
}
