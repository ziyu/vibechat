import { describe, expect, it, vi } from "vitest";
import {
  MatrixRoomAdapterError,
  SynapseMatrixRoomAdapter,
} from "@libs/rooms/synapse-room-adapter";

const input = {
  creatorMatrixUserId: "@vibe_creator:localhost",
  accessToken: "matrix-secret-token",
  name: "Afterglow",
  inviteMatrixUserIds: ["@vibe_friend:localhost"],
  space: {
    id: "space-campfire",
    versionId: "tplv-space-campfire-0-1-0",
    semanticVersion: "0.1.0",
    integrity: "template:space-campfire@0.1.0+sha256.example",
    permissions: ["messages.read", "messages.send"],
    networkDomains: [],
    publisher: {
      id: "publisher-vibechat",
      displayName: "VibeChat",
      verification: "official" as const,
    },
  },
  instanceConfig: { ambient: "night" },
};

describe("SynapseMatrixRoomAdapter", () => {
  it("creates a private room with invitees and the atmosphere state snapshot", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Response.json({ room_id: "!room:localhost" }),
    );
    const adapter = new SynapseMatrixRoomAdapter({
      homeserverUrl: "http://localhost:8008/",
      fetch,
    });

    await expect(adapter.createRoom(input)).resolves.toEqual({
      matrixRoomId: "!room:localhost",
    });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("http://localhost:8008/_matrix/client/v3/createRoom");
    expect(init?.headers).toMatchObject({
      authorization: "Bearer matrix-secret-token",
      "content-type": "application/json",
    });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      preset: "private_chat",
      invite: ["@vibe_friend:localhost"],
      is_direct: true,
      initial_state: [{
        type: "io.vibechat.space.instance.v1",
        state_key: "",
        content: {
          templateId: "space-campfire",
          templateVersionId: "tplv-space-campfire-0-1-0",
          publisher: {
            id: "publisher-vibechat",
            verification: "official",
          },
          createdBy: "@vibe_creator:localhost",
          instanceConfig: { ambient: "night" },
        },
      }],
    });
  });

  it("returns a stable error without response or access-token contents", async () => {
    const adapter = new SynapseMatrixRoomAdapter({
      homeserverUrl: "http://localhost:8008",
      fetch: async () => Response.json({
        errcode: "M_FORBIDDEN",
        error: `do not expose ${input.accessToken}`,
      }, { status: 403 }),
    });

    const error = await adapter.createRoom(input).catch((caught) => caught);

    expect(error).toBeInstanceOf(MatrixRoomAdapterError);
    expect(error).toMatchObject({ status: 403, matrixErrorCode: "M_FORBIDDEN" });
    expect(JSON.stringify(error)).not.toContain(input.accessToken);
  });
});
