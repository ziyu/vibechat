import type { MatrixIdentityRecord } from "@libs/identity";
import type { CreateMatrixRoomInput, RoomIndexRecord } from "./types";

export interface RoomRepository {
  getByClientRequestId(
    creatorUserId: string,
    clientRequestId: string,
  ): Promise<RoomIndexRecord | null>;
  create(record: RoomIndexRecord): Promise<RoomIndexRecord>;
}

export interface RoomIdentityReader {
  getMatrixIdentity(userId: string): Promise<MatrixIdentityRecord | null>;
}

export interface MatrixRoomAdapter {
  createRoom(input: CreateMatrixRoomInput): Promise<{ matrixRoomId: string }>;
}
