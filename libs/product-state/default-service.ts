import { DatabaseRoomRepository } from "@libs/rooms";
import { DatabaseProductStateRepository } from "./database-repository";
import { ProductStateService } from "./service";

export function createDefaultProductStateService() {
  return new ProductStateService({
    repository: new DatabaseProductStateRepository(),
    rooms: new DatabaseRoomRepository(),
  });
}
