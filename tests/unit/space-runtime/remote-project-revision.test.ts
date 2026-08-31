import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BackendRemoteProjectStore } from "../../../apps/space-runtime/src/remote-project-store";

afterEach(() => vi.unstubAllGlobals());

describe("BackendRemoteProjectStore historical Revision reads", () => {
  it("loads a Project only when the authority record and object hash agree", async () => {
    const project = storedProject();
    const content = new TextEncoder().encode(`${JSON.stringify(project)}\n`);
    const objectHash = createHash("sha256").update(content).digest("hex");
    vi.stubGlobal("fetch", revisionFetch(project, content, objectHash));
    const store = new BackendRemoteProjectStore(
      "http://backend.test",
      "test-runtime-signing-secret-at-least-32-chars",
    );

    await expect(store.loadRevision("space-revision-1", "0123456789abcdef"))
      .resolves.toEqual(project);
  });

  it("rejects a tampered historical object before Candidate validation", async () => {
    const project = storedProject();
    const content = new TextEncoder().encode(`${JSON.stringify(project)}\n`);
    const objectHash = createHash("sha256").update(content).digest("hex");
    const tampered = new TextEncoder().encode(`${JSON.stringify({ ...project, summary: "tampered" })}\n`);
    vi.stubGlobal("fetch", revisionFetch(project, tampered, objectHash));
    const store = new BackendRemoteProjectStore(
      "http://backend.test",
      "test-runtime-signing-secret-at-least-32-chars",
    );

    await expect(store.loadRevision("space-revision-1", "0123456789abcdef"))
      .rejects.toThrow(/object integrity/i);
  });
});

function revisionFetch(
  project: ReturnType<typeof storedProject>,
  content: Uint8Array,
  objectHash: string,
) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === "/v1/internal/space-runtime-control") {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body).toMatchObject({
        action: "load_project_revision",
        spaceInstanceId: project.appId,
        revisionId: project.draftId,
      });
      return Response.json({
        revision: {
          spaceInstanceId: project.appId,
          projectId: "project-revision-1",
          revisionId: project.draftId,
          parentRevisionId: null,
          sourceObjectKey: `space-runtime/objects/${objectHash}`,
          sourceHash: project.sourceHash,
          metadata: {},
          fencingToken: 1,
          createdAt: "2026-08-28T00:00:00.000Z",
        },
      });
    }
    if (url.pathname === `/v1/internal/space-runtime-objects/${objectHash}`) {
      return new Response(content, {
        headers: { "content-type": "application/json" },
      });
    }
    throw new Error(`Unexpected request ${url.pathname}`);
  });
}

function storedProject() {
  return {
    appId: "space-revision-1",
    files: {
      "package.json": "{}",
      "tsconfig.json": "{}",
      "src/index.ts": "export const revision = true",
    },
    sourceHash: `sha256:${"a".repeat(64)}` as const,
    summary: "Historical Project",
    updatedAt: "2026-08-28T00:00:00.000Z",
    draftId: "0123456789abcdef",
  };
}
