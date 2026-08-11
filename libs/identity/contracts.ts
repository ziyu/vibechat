import type {
  IntegrationOutboxRecord,
  MatrixIdentityRecord,
  MatrixSessionBindingRecord,
  ProductProfile,
  ProductProfileUpdate,
} from "./types";

export interface IdentityRepository {
  ensureProfile(profile: ProductProfile): Promise<ProductProfile>;
  getProfile(userId: string): Promise<ProductProfile | null>;
  getProfileByUsername(username: string): Promise<ProductProfile | null>;
  updateProfile(
    userId: string,
    update: Omit<ProductProfileUpdate, "completeOnboarding"> & {
      onboardingCompletedAt?: Date | null;
      updatedAt: Date;
    },
  ): Promise<ProductProfile | null>;
  getMatrixIdentity(userId: string): Promise<MatrixIdentityRecord | null>;
  ensureMatrixIdentity(identity: MatrixIdentityRecord): Promise<MatrixIdentityRecord>;
  getSessionBinding(authSessionId: string): Promise<MatrixSessionBindingRecord | null>;
  ensureSessionBinding(binding: MatrixSessionBindingRecord): Promise<{
    binding: MatrixSessionBindingRecord;
    created: boolean;
  }>;
  revokeSessionBinding(
    authSessionId: string,
    revokedAt: Date,
    outboxEvent: IntegrationOutboxRecord,
  ): Promise<MatrixSessionBindingRecord | null>;
  listPendingOutboxEvents(
    availableAt: Date,
    limit: number,
  ): Promise<IntegrationOutboxRecord[]>;
  markOutboxEventProcessed(eventId: string, processedAt: Date): Promise<void>;
  rescheduleOutboxEvent(
    eventId: string,
    attempts: number,
    availableAt: Date,
  ): Promise<void>;
}

export interface MatrixTokenProtector {
  protect(accessToken: string): Promise<string>;
  unprotect(ciphertext: string): Promise<string>;
}

export type SynapseAvailability =
  | {
      available: false;
      reason: "SYNAPSE_NOT_CONFIGURED";
    }
  | {
      available: true;
      homeserverUrl: string;
    };

export interface SynapseAdapter {
  availability(): SynapseAvailability;
  ensureUser(input: {
    externalUserId: string;
    localpart: string;
    displayName: string;
  }): Promise<{ matrixUserId: string }>;
  createSessionDevice(input: {
    matrixUserId: string;
    authSessionId: string;
    displayName: string;
  }): Promise<{ deviceId: string; accessToken: string }>;
  revokeDevice(input: {
    matrixUserId: string;
    deviceId: string;
    accessToken: string;
  }): Promise<void>;
}
