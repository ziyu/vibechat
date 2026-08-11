export type ProductProfileStatus = "active" | "disabled";
export type MatrixIdentityStatus = "active" | "disabled";

export interface AuthenticatedUserIdentity {
  userId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface ProductProfile {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  status: ProductProfileStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface MatrixIdentityRecord {
  userId: string;
  matrixUserId: string;
  status: MatrixIdentityStatus;
  provisionedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MatrixSessionBindingRecord {
  authSessionId: string;
  userId: string;
  matrixUserId: string;
  matrixDeviceId: string;
  matrixAccessTokenCiphertext: string;
  createdAt: Date;
  revokedAt: Date | null;
}

export interface ActiveMatrixSessionCredentials {
  authSessionId: string;
  matrixUserId: string;
  matrixDeviceId: string;
  accessToken: string;
}

export interface IntegrationOutboxRecord {
  id: string;
  eventType: "matrix.device.revoke";
  aggregateId: string;
  payload: {
    matrixUserId: string;
    matrixDeviceId: string;
  };
  attempts: number;
  availableAt: Date;
  processedAt: Date | null;
}

export type MatrixBootstrapResult =
  | {
      status: "unavailable";
      reason: "SYNAPSE_NOT_CONFIGURED";
    }
  | {
      status: "ready";
      homeserverUrl: string;
      userId: string;
      deviceId: string;
      accessToken: string;
    };

export interface IdentityBootstrapResult {
  profile: ProductProfile;
  matrix: MatrixBootstrapResult;
}
