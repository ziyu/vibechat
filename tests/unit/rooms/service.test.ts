import { describe, expect, it, vi } from "vitest";
import type { BuiltInChatSpaceConfig } from "@config";
import type { MatrixIdentityRecord } from "@libs/identity";
import type { MatrixRoomAdapter, RoomRepository } from "@libs/rooms/contracts";
import { RoomService, RoomServiceError } from "@libs/rooms/service";
import type { RoomIndexRecord } from "@libs/rooms/types";

const space: BuiltInChatSpaceConfig = {
  spaceId: "space-campfire",
  spaceVersionId: "builtin-space-campfire-v1",
  semanticVersion: "1.0.0",
  integrity: "builtin:space-campfire@1.0.0",
  category: "daily",
  name: { en: "Afterglow Radio", "zh-CN": "夜航电台" },
  summary: { en: "A late-night room.", "zh-CN": "深夜房间。" },
  author: "Vibe Chat Studio",
  icon: "◐",
  accent: "#ff6b42",
  canvas: "#171b20",
  permissions: ["messages.read", "messages.send"],
  networkDomains: [],
  official: true,
};

class MemoryRoomRepository implements RoomRepository {
  records: RoomIndexRecord[] = [];

  async getByClientRequestId(creatorUserId: string, clientRequestId: string) {
    return this.records.find((record) =>
      record.creatorUserId === creatorUserId && record.clientRequestId === clientRequestId
    ) || null;
  }

  async create(record: RoomIndexRecord) {
    this.records.push(record);
    return record;
  }

  async getAccessibleByMatrixRoomIds(userId: string, matrixRoomIds: string[]) {
    return this.records.filter((record) =>
      matrixRoomIds.includes(record.matrixRoomId)
      && record.participantUserIds.includes(userId)
    );
  }
}

const identities = new Map<string, MatrixIdentityRecord>([
  ["friend-1", {
    userId: "friend-1",
    matrixUserId: "@vibe_friend_1:localhost",
    status: "active",
    provisionedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }],
]);

function createService() {
  const repository = new MemoryRoomRepository();
  const createRoom = vi.fn<MatrixRoomAdapter["createRoom"]>(async () => ({
    matrixRoomId: "!matrix-room:localhost",
  }));
  const service = new RoomService({
    repository,
    identities: {
      getMatrixIdentity: async (userId) => identities.get(userId) || null,
    },
    participantPolicy: { assertCanInvite: async () => undefined },
    matrix: { createRoom },
    spaces: [space],
    now: () => new Date("2026-08-11T15:00:00.000Z"),
  });

  return { createRoom, repository, service };
}

const input = {
  creatorUserId: "creator-1",
  creatorMatrixUserId: "@vibe_creator_1:localhost",
  accessToken: "matrix-secret-token",
  clientRequestId: "request-12345678",
  participantUserIds: ["friend-1"],
  spaceId: space.spaceId,
  instanceConfig: { ambient: "night" },
  name: "Afterglow · Friend",
};

describe("RoomService", () => {
  it("creates one Matrix room with an immutable atmosphere snapshot", async () => {
    const { createRoom, repository, service } = createService();

    const result = await service.createRoom(input);

    expect(result).toMatchObject({
      matrixRoomId: "!matrix-room:localhost",
      spaceInstanceId: expect.stringMatching(/^space-/),
      projectId: expect.stringMatching(/^project-/),
      defaultAgentId: "pi",
      spaceId: space.spaceId,
      spaceVersionId: space.spaceVersionId,
      creatorUserId: input.creatorUserId,
      participantUserIds: [input.creatorUserId, "friend-1"],
      instanceConfig: input.instanceConfig,
    });
    expect(createRoom).toHaveBeenCalledWith({
      creatorMatrixUserId: input.creatorMatrixUserId,
      accessToken: input.accessToken,
      name: input.name,
      inviteMatrixUserIds: ["@vibe_friend_1:localhost"],
      space,
      instanceConfig: input.instanceConfig,
    });
    expect(repository.records).toHaveLength(1);
    await expect(service.getAccessibleSpaceInstance(
      input.creatorUserId,
      result.matrixRoomId,
    )).resolves.toEqual(result);
  });

  it("returns the existing room for a repeated client request", async () => {
    const { createRoom, repository, service } = createService();

    const first = await service.createRoom(input);
    const repeated = await service.createRoom(input);

    expect(repeated).toEqual(first);
    expect(createRoom).toHaveBeenCalledTimes(1);
    expect(repository.records).toHaveLength(1);
  });

  it("rejects unknown spaces and participants without active Matrix identities", async () => {
    const { createRoom, service } = createService();

    await expect(service.createRoom({ ...input, spaceId: "missing-space" }))
      .rejects.toEqual(expect.objectContaining<Partial<RoomServiceError>>({
        code: "ROOM_SPACE_NOT_FOUND",
      }));
    await expect(service.createRoom({
      ...input,
      clientRequestId: "request-missing-person",
      participantUserIds: ["missing-user"],
    })).rejects.toEqual(expect.objectContaining<Partial<RoomServiceError>>({
      code: "ROOM_PARTICIPANT_NOT_READY",
    }));
    expect(createRoom).not.toHaveBeenCalled();
  });
});
