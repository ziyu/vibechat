import { builtInChatSpaces } from "@config";
import { DatabaseIdentityRepository, readMatrixRuntimeConfig } from "@libs/identity";
import { DatabaseRoomRepository } from "./database-repository";
import { RoomService } from "./service";
import { SynapseMatrixRoomAdapter } from "./synapse-room-adapter";

export function createDefaultRoomService() {
  const config = readMatrixRuntimeConfig();
  if (config.status !== "ready") {
    throw new Error("Matrix room service is not configured");
  }

  return new RoomService({
    repository: new DatabaseRoomRepository(),
    identities: new DatabaseIdentityRepository(),
    matrix: new SynapseMatrixRoomAdapter({ homeserverUrl: config.homeserverUrl }),
    spaces: builtInChatSpaces,
  });
}
