import { DatabaseIdentityRepository } from "./database-repository";
import { readMatrixRuntimeConfig } from "./config";
import { MatrixDeviceRevocationWorker } from "./device-revocation-worker";
import { IdentityService } from "./service";
import { SynapseAppserviceAdapter } from "./synapse-appservice";
import { UnavailableSynapseAdapter } from "./synapse";
import {
  AesGcmMatrixTokenProtector,
  UnavailableMatrixTokenProtector,
} from "./token-protector";

export function createDefaultIdentityService() {
  const config = readMatrixRuntimeConfig();
  if (config.status === "ready") {
    return new IdentityService({
      repository: new DatabaseIdentityRepository(),
      synapse: new SynapseAppserviceAdapter({
        homeserverUrl: config.homeserverUrl,
        publicHomeserverUrl: config.publicHomeserverUrl,
        serverName: config.serverName,
        appserviceToken: config.appserviceToken,
        userPrefix: config.userPrefix,
      }),
      tokenProtector: new AesGcmMatrixTokenProtector(config.tokenEncryptionKey),
    });
  }

  return new IdentityService({
    repository: new DatabaseIdentityRepository(),
    synapse: new UnavailableSynapseAdapter(),
    tokenProtector: new UnavailableMatrixTokenProtector(),
  });
}

export function createDefaultMatrixDeviceRevocationWorker() {
  const config = readMatrixRuntimeConfig();
  const repository = new DatabaseIdentityRepository();

  if (config.status === "ready") {
    return new MatrixDeviceRevocationWorker({
      repository,
      synapse: new SynapseAppserviceAdapter({
        homeserverUrl: config.homeserverUrl,
        publicHomeserverUrl: config.publicHomeserverUrl,
        serverName: config.serverName,
        appserviceToken: config.appserviceToken,
        userPrefix: config.userPrefix,
      }),
      tokenProtector: new AesGcmMatrixTokenProtector(config.tokenEncryptionKey),
    });
  }

  return new MatrixDeviceRevocationWorker({
    repository,
    synapse: new UnavailableSynapseAdapter(),
    tokenProtector: new UnavailableMatrixTokenProtector(),
  });
}
