import { and, eq } from "drizzle-orm";
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
      clientRequestId: record.clientRequestId,
      spaceId: record.spaceId,
      spaceVersionId: record.spaceVersionId,
      creatorUserId: record.creatorUserId,
      instanceConfigJson: record.instanceConfig,
      status: record.status,
      createdAt: record.createdAt,
    });
    const stored = await this.getByClientRequestId(
      record.creatorUserId,
      record.clientRequestId,
    );
    if (!stored) throw new Error("Room index could not be persisted");
    return stored;
  }

  private toRecord(stored: typeof roomIndex.$inferSelect): RoomIndexRecord {
    return {
      matrixRoomId: stored.matrixRoomId,
      clientRequestId: stored.clientRequestId,
      spaceId: stored.spaceId,
      spaceVersionId: stored.spaceVersionId,
      creatorUserId: stored.creatorUserId,
      instanceConfig: stored.instanceConfigJson,
      status: stored.status as RoomIndexRecord["status"],
      createdAt: stored.createdAt,
    };
  }
}
