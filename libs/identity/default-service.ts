import { DatabaseIdentityRepository } from "./database-repository";
import { IdentityService } from "./service";
import { UnavailableSynapseAdapter } from "./synapse";
import { UnavailableMatrixTokenProtector } from "./token-protector";

export function createDefaultIdentityService() {
  return new IdentityService({
    repository: new DatabaseIdentityRepository(),
    synapse: new UnavailableSynapseAdapter(),
    tokenProtector: new UnavailableMatrixTokenProtector(),
  });
}
