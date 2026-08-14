import type {
  IdentityRepository,
  MatrixTokenProtector,
  SynapseAdapter,
} from "./contracts";
import type {
  AuthenticatedUserIdentity,
  ActiveMatrixSessionCredentials,
  IdentityBootstrapResult,
  IntegrationOutboxRecord,
  MatrixIdentityRecord,
  MatrixSessionBindingRecord,
  ProductProfile,
  ProductProfileUpdate,
} from "./types";
import { deriveDisplayName, deriveUsername } from "./username";

export interface IdentityServiceOptions {
  repository: IdentityRepository;
  synapse: SynapseAdapter;
  tokenProtector: MatrixTokenProtector;
  now?: () => Date;
  createId?: () => string;
}

export type IdentityServiceErrorCode =
  | "PROFILE_NOT_FOUND"
  | "PROFILE_USERNAME_TAKEN";

export class IdentityServiceError extends Error {
  readonly code: IdentityServiceErrorCode;

  constructor(code: IdentityServiceErrorCode) {
    super(code);
    this.name = "IdentityServiceError";
    this.code = code;
  }
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

    const credentials = await this.synapse.createSessionDevice({
      matrixUserId: identity.matrixUserId,
      authSessionId,
      displayName: `VibeChat · ${profile.username}`,
    });
    const protectedToken = await this.tokenProtector.protect(credentials.accessToken);
    const now = this.now();
    const ensured = await this.repository.ensureSessionBinding({
      authSessionId,
      userId: profile.userId,
      matrixUserId: identity.matrixUserId,
      matrixDeviceId: credentials.deviceId,
      matrixAccessTokenCiphertext: protectedToken,
      createdAt: now,
      revokedAt: null,
    });

    if (!ensured.created && ensured.binding.matrixDeviceId !== credentials.deviceId) {
      await this.synapse.revokeDevice({
        matrixUserId: identity.matrixUserId,
        deviceId: credentials.deviceId,
        accessToken: credentials.accessToken,
      });
    }

    const accessToken = ensured.created
      ? credentials.accessToken
      : await this.tokenProtector.unprotect(
          ensured.binding.matrixAccessTokenCiphertext,
        );

    return {
      profile,
      matrix: {
        status: "ready",
        homeserverUrl: availability.homeserverUrl,
        userId: ensured.binding.matrixUserId,
        deviceId: ensured.binding.matrixDeviceId,
        accessToken,
      },
    };
  }

  getOrCreateProfile(user: AuthenticatedUserIdentity) {
    return this.ensureProfile(user);
  }

  async updateProfile(userId: string, input: ProductProfileUpdate) {
    const existing = await this.repository.getProfile(userId);
    if (!existing) throw new IdentityServiceError("PROFILE_NOT_FOUND");

    const username = input.username?.trim().toLowerCase();
    if (username && username !== existing.username) {
      const owner = await this.repository.getProfileByUsername(username);
      if (owner && owner.userId !== userId) {
        throw new IdentityServiceError("PROFILE_USERNAME_TAKEN");
      }
    }

    let updated: ProductProfile | null;
    try {
      updated = await this.repository.updateProfile(userId, {
        ...(username ? { username } : {}),
        ...(input.displayName !== undefined ? { displayName: input.displayName.trim() } : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
        ...(input.completeOnboarding && !existing.onboardingCompletedAt
          ? { onboardingCompletedAt: this.now() }
          : {}),
        updatedAt: this.now(),
      });
    } catch (error) {
      // The unique index is the final authority when two users claim the same
      // username between the preflight read and the update.
      if (username && username !== existing.username) {
        const owner = await this.repository.getProfileByUsername(username);
        if (owner && owner.userId !== userId) {
          throw new IdentityServiceError("PROFILE_USERNAME_TAKEN");
        }
      }
      throw error;
    }
    if (!updated) throw new IdentityServiceError("PROFILE_NOT_FOUND");
    return updated;
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

  async getActiveSessionCredentials(
    authSessionId: string,
  ): Promise<ActiveMatrixSessionCredentials | null> {
    if (!this.synapse.availability().available) return null;
    const binding = await this.repository.getSessionBinding(authSessionId);
    if (!binding || binding.revokedAt) return null;

    return {
      authSessionId,
      matrixUserId: binding.matrixUserId,
      matrixDeviceId: binding.matrixDeviceId,
      accessToken: await this.tokenProtector.unprotect(
        binding.matrixAccessTokenCiphertext,
      ),
    };
  }

  private async ensureProfile(user: AuthenticatedUserIdentity) {
    const now = this.now();
    const username = deriveUsername(user.email, user.userId);
    const candidate: ProductProfile = {
      userId: user.userId,
      username,
      displayName: deriveDisplayName(user.displayName, user.email, username),
      avatarUrl: user.avatarUrl,
      onboardingCompletedAt: null,
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
