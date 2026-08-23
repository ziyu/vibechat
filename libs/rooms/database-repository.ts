import { and, eq, inArray } from "drizzle-orm";
import { db, roomIndex } from "@libs/database";
import type { RoomRepository } from "./contracts";
import type { RoomIndexRecord } from "./types";

export class DatabaseRoomRepository implements RoomRepository {
  async getByClientRequestId(creatorUserId: string, clientRequestId: string) {
    const [stored] = await db
      .select()
      .from(roomIndex)
      .where(and(
        eq(roomIndex.creatorUserId, creatorUserId),
        eq(roomIndex.clientRequestId, clientRequestId),
      ))
      .limit(1);

    return stored ? this.toRecord(stored) : null;
  }

  async create(record: RoomIndexRecord) {
    await db.insert(roomIndex).values({
      matrixRoomId: record.matrixRoomId,
      spaceInstanceId: record.spaceInstanceId,
      projectId: record.projectId,
      defaultAgentId: record.defaultAgentId,
      clientRequestId: record.clientRequestId,
      spaceId: record.spaceId,
      spaceVersionId: record.spaceVersionId,
      creatorUserId: record.creatorUserId,
      participantUserIdsJson: record.participantUserIds,
      instanceConfigJson: record.instanceConfig,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
    const stored = await this.getByClientRequestId(
      record.creatorUserId,
      record.clientRequestId,
    );
    if (!stored) throw new Error("Room index could not be persisted");
    return stored;
  }

  async getAccessibleByMatrixRoomIds(userId: string, matrixRoomIds: string[]) {
    if (!matrixRoomIds.length) return [];
    const stored = await db
      .select()
      .from(roomIndex)
      .where(inArray(roomIndex.matrixRoomId, matrixRoomIds));
    return stored
      .map((room) => this.toRecord(room))
      .filter((room) => room.participantUserIds.includes(userId));
  }

  private toRecord(stored: typeof roomIndex.$inferSelect): RoomIndexRecord {
    return {
      matrixRoomId: stored.matrixRoomId,
      spaceInstanceId: stored.spaceInstanceId || legacySpaceInstanceId(stored.matrixRoomId),
      projectId: stored.projectId || legacyProjectId(stored.matrixRoomId),
      defaultAgentId: stored.defaultAgentId || "pi",
      clientRequestId: stored.clientRequestId,
      spaceId: stored.spaceId,
      spaceVersionId: stored.spaceVersionId,
      creatorUserId: stored.creatorUserId,
      participantUserIds: stored.participantUserIdsJson.length
        ? stored.participantUserIdsJson
        : [stored.creatorUserId],
      instanceConfig: stored.instanceConfigJson,
      status: stored.status as RoomIndexRecord["status"],
      createdAt: stored.createdAt,
      updatedAt: stored.updatedAt,
    };
  }
}

function legacySpaceInstanceId(matrixRoomId: string) {
  return `space-${stableId(matrixRoomId)}`;
}

function legacyProjectId(matrixRoomId: string) {
  return `project-${stableId(matrixRoomId)}`;
}

function stableId(value: string) {
  let hash = 2166136261;
  let secondary = 5381;
  for (const character of value) {
    hash ^= character.codePointAt(0) || 0;
    hash = Math.imul(hash, 16777619);
    secondary = Math.imul(secondary, 33) ^ (character.codePointAt(0) || 0);
  }
  return `${(hash >>> 0).toString(36)}-${(secondary >>> 0).toString(36)}-${value.length.toString(36)}`;
}
