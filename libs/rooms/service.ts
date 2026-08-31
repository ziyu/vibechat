import type { PublishedSpaceTemplateCatalogEntry } from "@config";
import type {
  MatrixRoomAdapter,
  RoomIdentityReader,
  RoomParticipantPolicy,
  RoomRepository,
} from "./contracts";
import type { RoomIndexRecord } from "./types";

export type RoomServiceErrorCode =
  | "ROOM_SPACE_NOT_FOUND"
  | "ROOM_SPACE_VERSION_NOT_FOUND"
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
  startMode: "blank" | "template";
  spaceTemplateId: string | null;
  spaceTemplateVersionId: string | null;
  instanceConfig: Record<string, unknown>;
  name: string;
}

export class RoomService {
  constructor(private readonly options: {
    repository: RoomRepository;
    identities: RoomIdentityReader;
    participantPolicy: RoomParticipantPolicy;
    matrix: MatrixRoomAdapter;
    spaces: readonly PublishedSpaceTemplateCatalogEntry[];
    now?: () => Date;
  }) {}

  async createRoom(input: CreateRoomServiceInput) {
    const existing = await this.options.repository.getByClientRequestId(
      input.creatorUserId,
      input.clientRequestId,
    );
    if (existing) return existing;

    const space = input.startMode === "template"
      ? this.options.spaces.find((candidate) => candidate.id === input.spaceTemplateId) ?? null
      : null;
    if (input.startMode === "template" && !space) {
      throw new RoomServiceError("ROOM_SPACE_NOT_FOUND");
    }
    if (
      space
      && input.spaceTemplateVersionId
      && space.versionId !== input.spaceTemplateVersionId
    ) {
      throw new RoomServiceError("ROOM_SPACE_VERSION_NOT_FOUND");
    }

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

    const spaceInstanceId = `space-${globalThis.crypto.randomUUID()}`;
    const projectId = `project-${globalThis.crypto.randomUUID()}`;
    const defaultAgentId = "pi";
    const created = await this.options.matrix.createRoom({
      creatorMatrixUserId: input.creatorMatrixUserId,
      accessToken: input.accessToken,
      name: input.name,
      inviteMatrixUserIds: identities.map((identity) => identity!.matrixUserId),
      spaceInstanceId,
      projectId,
      defaultAgentId,
      space,
      instanceConfig: input.instanceConfig,
    });
    const record: RoomIndexRecord = {
      matrixRoomId: created.matrixRoomId,
      spaceInstanceId,
      projectId,
      defaultAgentId,
      clientRequestId: input.clientRequestId,
      spaceId: space?.id ?? null,
      spaceVersionId: space?.versionId ?? null,
      creatorUserId: input.creatorUserId,
      participantUserIds: Array.from(new Set([
        input.creatorUserId,
        ...participantUserIds,
      ])),
      instanceConfig: input.instanceConfig,
      status: "active",
      createdAt: this.options.now?.() || new Date(),
      updatedAt: this.options.now?.() || new Date(),
    };

    return this.options.repository.create(record);
  }

  lookupAccessibleRooms(userId: string, matrixRoomIds: string[]) {
    return this.options.repository.getAccessibleByMatrixRoomIds(userId, matrixRoomIds);
  }

  async getAccessibleSpaceInstance(userId: string, matrixRoomId: string) {
    const [record] = await this.options.repository.getAccessibleByMatrixRoomIds(
      userId,
      [matrixRoomId],
    );
    return record ?? null;
  }
}

export { RoomService as SpaceInstanceService };
