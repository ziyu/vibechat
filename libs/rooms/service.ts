import type { BuiltInChatSpaceConfig } from "@config";
import type {
  MatrixRoomAdapter,
  RoomIdentityReader,
  RoomParticipantPolicy,
  RoomRepository,
} from "./contracts";
import type { RoomIndexRecord } from "./types";

export type RoomServiceErrorCode =
  | "ROOM_SPACE_NOT_FOUND"
  | "ROOM_PARTICIPANT_NOT_READY";

export class RoomServiceError extends Error {
  readonly code: RoomServiceErrorCode;

  constructor(code: RoomServiceErrorCode) {
    super(code);
    this.name = "RoomServiceError";
    this.code = code;
  }
}

export interface CreateRoomServiceInput {
  creatorUserId: string;
  creatorMatrixUserId: string;
  accessToken: string;
  clientRequestId: string;
  participantUserIds: string[];
  spaceId: string;
  instanceConfig: Record<string, unknown>;
  name: string;
}

export class RoomService {
  constructor(private readonly options: {
    repository: RoomRepository;
    identities: RoomIdentityReader;
    participantPolicy: RoomParticipantPolicy;
    matrix: MatrixRoomAdapter;
    spaces: BuiltInChatSpaceConfig[];
    now?: () => Date;
  }) {}

  async createRoom(input: CreateRoomServiceInput) {
    const existing = await this.options.repository.getByClientRequestId(
      input.creatorUserId,
      input.clientRequestId,
    );
    if (existing) return existing;

    const space = this.options.spaces.find((candidate) => candidate.spaceId === input.spaceId);
    if (!space) throw new RoomServiceError("ROOM_SPACE_NOT_FOUND");

    const participantUserIds = input.participantUserIds.filter(
      (userId) => userId !== input.creatorUserId,
    );
    await this.options.participantPolicy.assertCanInvite(
      input.creatorUserId,
      participantUserIds,
    );
    const identities = await Promise.all(
      participantUserIds.map((userId) => this.options.identities.getMatrixIdentity(userId)),
    );
    if (identities.some((identity) => !identity || identity.status !== "active")) {
      throw new RoomServiceError("ROOM_PARTICIPANT_NOT_READY");
    }

    const created = await this.options.matrix.createRoom({
      creatorMatrixUserId: input.creatorMatrixUserId,
      accessToken: input.accessToken,
      name: input.name,
      inviteMatrixUserIds: identities.map((identity) => identity!.matrixUserId),
      space,
      instanceConfig: input.instanceConfig,
    });
    const record: RoomIndexRecord = {
      matrixRoomId: created.matrixRoomId,
      clientRequestId: input.clientRequestId,
      spaceId: space.spaceId,
      spaceVersionId: space.spaceVersionId,
      creatorUserId: input.creatorUserId,
      participantUserIds: Array.from(new Set([
        input.creatorUserId,
        ...participantUserIds,
      ])),
      instanceConfig: input.instanceConfig,
      status: "active",
      createdAt: this.options.now?.() || new Date(),
    };

    return this.options.repository.create(record);
  }

  lookupAccessibleRooms(userId: string, matrixRoomIds: string[]) {
    return this.options.repository.getAccessibleByMatrixRoomIds(userId, matrixRoomIds);
  }
}
