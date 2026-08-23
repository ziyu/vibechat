export interface RoomIndexRecord {
  matrixRoomId: string;
  spaceInstanceId: string;
  projectId: string;
  defaultAgentId: string;
  clientRequestId: string;
  spaceId: string;
  spaceVersionId: string;
  creatorUserId: string;
  participantUserIds: string[];
  instanceConfig: Record<string, unknown>;
  status: "active";
  createdAt: Date;
  updatedAt: Date;
}

export type SpaceInstanceRecord = RoomIndexRecord;

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
