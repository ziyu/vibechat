import type {
  IdentityRepository,
  MatrixTokenProtector,
  SynapseAdapter,
} from "./contracts";
import type {
  AuthenticatedUserIdentity,
  IdentityBootstrapResult,
  IntegrationOutboxRecord,
  MatrixIdentityRecord,
  MatrixSessionBindingRecord,
  ProductProfile,
} from "./types";
import { deriveDisplayName, deriveUsername } from "./username";

export interface IdentityServiceOptions {
  repository: IdentityRepository;
  synapse: SynapseAdapter;
  tokenProtector: MatrixTokenProtector;
  now?: () => Date;
  createId?: () => string;
}

export class IdentityService {
  private readonly repository: IdentityRepository;
  private readonly synapse: SynapseAdapter;
  private readonly tokenProtector: MatrixTokenProtector;
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(options: IdentityServiceOptions) {
    this.repository = options.repository;
    this.synapse = options.synapse;
    this.tokenProtector = options.tokenProtector;
    this.now = options.now || (() => new Date());
    this.createId = options.createId || (() => globalThis.crypto.randomUUID());
  }

  async bootstrapSession(
    user: AuthenticatedUserIdentity,
    authSessionId: string,
  ): Promise<IdentityBootstrapResult> {
    const profile = await this.ensureProfile(user);
    const availability = this.synapse.availability();

    if (!availability.available) {
      return {
        profile,
        matrix: {
          status: "unavailable",
          reason: availability.reason,
        },
      };
    }

    const identity = await this.ensureMatrixIdentity(profile);
    const existingBinding = await this.repository.getSessionBinding(authSessionId);

    if (existingBinding) {
      if (existingBinding.revokedAt) {
        throw new Error("The Matrix device binding for this session has been revoked");
      }

      return {
        profile,
        matrix: {
          status: "ready",
          homeserverUrl: availability.homeserverUrl,
          userId: existingBinding.matrixUserId,
          deviceId: existingBinding.matrixDeviceId,
          accessToken: await this.tokenProtector.unprotect(
            existingBinding.matrixAccessTokenCiphertext,
          ),
        },
      };
    }

    const credentials = await this.synapse.ensureSessionDevice({
      matrixUserId: identity.matrixUserId,
      authSessionId,
      displayName: `VibeChat · ${profile.username}`,
    });
    const protectedToken = await this.tokenProtector.protect(credentials.accessToken);
    const now = this.now();
    const binding = await this.repository.ensureSessionBinding({
      authSessionId,
      userId: profile.userId,
      matrixUserId: identity.matrixUserId,
      matrixDeviceId: credentials.deviceId,
      matrixAccessTokenCiphertext: protectedToken,
      createdAt: now,
      revokedAt: null,
    });

    const accessToken = binding.matrixAccessTokenCiphertext === protectedToken
      ? credentials.accessToken
      : await this.tokenProtector.unprotect(binding.matrixAccessTokenCiphertext);

    return {
      profile,
      matrix: {
        status: "ready",
        homeserverUrl: availability.homeserverUrl,
        userId: binding.matrixUserId,
        deviceId: binding.matrixDeviceId,
        accessToken,
      },
    };
  }

  async revokeSession(authSessionId: string) {
    const binding = await this.repository.getSessionBinding(authSessionId);
    if (!binding) return null;

    const revokedAt = binding.revokedAt || this.now();
    const outboxEvent: IntegrationOutboxRecord = {
      id: this.createId(),
      eventType: "matrix.device.revoke",
      aggregateId: authSessionId,
      payload: {
        matrixUserId: binding.matrixUserId,
        matrixDeviceId: binding.matrixDeviceId,
      },
      attempts: 0,
      availableAt: revokedAt,
      processedAt: null,
    };

    return this.repository.revokeSessionBinding(
      authSessionId,
      revokedAt,
      outboxEvent,
    );
  }

  private async ensureProfile(user: AuthenticatedUserIdentity) {
    const now = this.now();
    const username = deriveUsername(user.email, user.userId);
    const candidate: ProductProfile = {
      userId: user.userId,
      username,
      displayName: deriveDisplayName(user.displayName, user.email, username),
      avatarUrl: user.avatarUrl,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    return this.repository.ensureProfile(candidate);
  }

  private async ensureMatrixIdentity(profile: ProductProfile) {
    const existing = await this.repository.getMatrixIdentity(profile.userId);
    if (existing) return existing;

    const provisioned = await this.synapse.ensureUser({
      externalUserId: profile.userId,
      localpart: profile.username,
      displayName: profile.displayName,
    });
    const now = this.now();
    const candidate: MatrixIdentityRecord = {
      userId: profile.userId,
      matrixUserId: provisioned.matrixUserId,
      status: "active",
      provisionedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    return this.repository.ensureMatrixIdentity(candidate);
  }
}
