export interface RoomIndexRecord {
  matrixRoomId: string;
  clientRequestId: string;
  spaceId: string;
  spaceVersionId: string;
  creatorUserId: string;
  instanceConfig: Record<string, unknown>;
  status: "active";
  createdAt: Date;
}

export interface CreateMatrixRoomInput {
  creatorMatrixUserId: string;
  accessToken: string;
  name: string;
  inviteMatrixUserIds: string[];
  space: {
    spaceId: string;
    semanticVersion: string;
    integrity: string;
    permissions: string[];
    networkDomains: string[];
  };
  instanceConfig: Record<string, unknown>;
}
