import { describe, expect, it, vi } from "vitest";
import { verifyLiveMatrixMembership } from "../../../apps/backend/src/lib/matrix-membership";

const identity = {
  userId: "member-1",
  matrixUserId: "@vibe_member_1:localhost",
  status: "active" as const,
  provisionedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};
const config = {
  status: "ready" as const,
  homeserverUrl: "http://synapse.test",
  publicHomeserverUrl: "http://synapse.test",
  serverName: "localhost",
  appserviceToken: "appservice-token",
  tokenEncryptionKey: "12345678901234567890123456789012",
  userPrefix: "vibe_",
};

describe("live Matrix membership authorization", () => {
  it("accepts only the current join membership and fails closed on leave", async () => {
    const getIdentity = vi.fn(async () => identity);
    const joinedFetch = vi.fn(async () => Response.json({ membership: "join" }));
    await expect(verifyLiveMatrixMembership({
      userId: identity.userId,
      matrixRoomId: "!space:localhost",
    }, { config, getIdentity, fetch: joinedFetch as typeof globalThis.fetch })).resolves.toBe(true);
    expect(String(joinedFetch.mock.calls[0]?.[0])).toContain("/state/m.room.member/%40vibe_member_1%3Alocalhost");

    const leftFetch = vi.fn(async () => Response.json({ membership: "leave" }));
    await expect(verifyLiveMatrixMembership({
      userId: identity.userId,
      matrixRoomId: "!space:localhost",
    }, { config, getIdentity, fetch: leftFetch as typeof globalThis.fetch })).resolves.toBe(false);
  });
});
