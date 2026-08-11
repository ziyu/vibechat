import { describe, expect, it } from "vitest";
import type {
  IdentityRepository,
  MatrixTokenProtector,
  SynapseAdapter,
} from "@libs/identity/contracts";
import type {
  IntegrationOutboxRecord,
  MatrixIdentityRecord,
  MatrixSessionBindingRecord,
  ProductProfile,
} from "@libs/identity/types";
import { IdentityService } from "@libs/identity/service";

class MemoryIdentityRepository implements IdentityRepository {
  readonly profiles = new Map<string, ProductProfile>();
  readonly identities = new Map<string, MatrixIdentityRecord>();
  readonly bindings = new Map<string, MatrixSessionBindingRecord>();
  readonly outbox = new Map<string, IntegrationOutboxRecord>();

  async ensureProfile(profile: ProductProfile) {
    const stored = this.profiles.get(profile.userId) || profile;
    this.profiles.set(profile.userId, stored);
    return stored;
  }

  async getMatrixIdentity(userId: string) {
    return this.identities.get(userId) || null;
  }

  async ensureMatrixIdentity(identity: MatrixIdentityRecord) {
    const stored = this.identities.get(identity.userId) || identity;
    this.identities.set(identity.userId, stored);
    return stored;
  }

  async getSessionBinding(authSessionId: string) {
    return this.bindings.get(authSessionId) || null;
  }

  async ensureSessionBinding(binding: MatrixSessionBindingRecord) {
    const existing = this.bindings.get(binding.authSessionId);
    const stored = existing || binding;
    this.bindings.set(binding.authSessionId, stored);
    return { binding: stored, created: !existing };
  }

  async revokeSessionBinding(
    authSessionId: string,
    revokedAt: Date,
    outboxEvent: IntegrationOutboxRecord,
  ) {
    const binding = this.bindings.get(authSessionId);
    if (!binding) return null;

    this.outbox.set(
      `${outboxEvent.eventType}:${outboxEvent.aggregateId}`,
      this.outbox.get(`${outboxEvent.eventType}:${outboxEvent.aggregateId}`) || outboxEvent,
    );
    const revoked = {
      ...binding,
      revokedAt: binding.revokedAt || revokedAt,
    };
    this.bindings.set(authSessionId, revoked);
    return revoked;
  }

  async listPendingOutboxEvents(availableAt: Date, limit: number) {
    return [...this.outbox.values()]
      .filter((event) => !event.processedAt && event.availableAt <= availableAt)
      .slice(0, limit);
  }

  async markOutboxEventProcessed(eventId: string, processedAt: Date) {
    for (const [key, event] of this.outbox) {
      if (event.id === eventId) {
        this.outbox.set(key, { ...event, processedAt });
      }
    }
  }

  async rescheduleOutboxEvent(eventId: string, attempts: number, availableAt: Date) {
    for (const [key, event] of this.outbox) {
      if (event.id === eventId) {
        this.outbox.set(key, { ...event, attempts, availableAt });
      }
    }
  }
}

class PrefixTokenProtector implements MatrixTokenProtector {
  readonly protectedValues: string[] = [];

  async protect(accessToken: string) {
    this.protectedValues.push(accessToken);
    return `ciphertext:${accessToken.split("").reverse().join("")}`;
  }

  async unprotect(ciphertext: string) {
    return ciphertext.replace("ciphertext:", "").split("").reverse().join("");
  }
}

class FakeSynapseAdapter implements SynapseAdapter {
  readonly users = new Map<string, string>();
  readonly devices: Array<{ deviceId: string; accessToken: string }> = [];
  readonly revokedDevices: Array<{ deviceId: string; accessToken: string }> = [];
  failDeviceProvision = false;

  availability() {
    return {
      available: true as const,
      homeserverUrl: "https://matrix.example.com",
    };
  }

  async ensureUser(input: { externalUserId: string; localpart: string }) {
    const matrixUserId = this.users.get(input.externalUserId)
      || `@${input.localpart}:example.com`;
    this.users.set(input.externalUserId, matrixUserId);
    return { matrixUserId };
  }

  async createSessionDevice(input: { authSessionId: string }) {
    if (this.failDeviceProvision) throw new Error("device provision failed");
    const stored = {
      deviceId: `DEVICE_${input.authSessionId}_${this.devices.length + 1}`,
      accessToken: `secret_${input.authSessionId}_${this.devices.length + 1}`,
    };
    this.devices.push(stored);
    return stored;
  }

  async revokeDevice(input: { deviceId: string; accessToken: string }) {
    this.revokedDevices.push(input);
  }
}

const authenticatedUser = {
  userId: "user_01JTESTACCOUNT",
  email: "Alice.Chat@example.com",
  displayName: "Alice",
  avatarUrl: null,
};

function createReadyService() {
  const repository = new MemoryIdentityRepository();
  const synapse = new FakeSynapseAdapter();
  const tokenProtector = new PrefixTokenProtector();
  const now = new Date("2026-08-11T08:00:00.000Z");
  const service = new IdentityService({
    repository,
    synapse,
    tokenProtector,
    now: () => now,
    createId: () => "outbox-1",
  });

  return { repository, service, synapse, tokenProtector };
}

describe("IdentityService", () => {
  it("persists the product profile as the display authority", async () => {
    const { repository, service } = createReadyService();
    const first = await service.bootstrapSession(authenticatedUser, "session-1");
    const second = await service.bootstrapSession(
      { ...authenticatedUser, displayName: "Changed in auth", avatarUrl: "https://example.com/new.png" },
      "session-1",
    );

    expect(first.profile.username).toBe("alice_chat_estaccount");
    expect(second.profile).toEqual(first.profile);
    expect(repository.profiles.size).toBe(1);
  });

  it("degrades safely when Synapse is unavailable", async () => {
    const repository = new MemoryIdentityRepository();
    const service = new IdentityService({
      repository,
      synapse: {
        availability: () => ({ available: false, reason: "SYNAPSE_NOT_CONFIGURED" }),
        ensureUser: async () => { throw new Error("must not be called"); },
        createSessionDevice: async () => { throw new Error("must not be called"); },
        revokeDevice: async () => { throw new Error("must not be called"); },
      },
      tokenProtector: {
        protect: async () => { throw new Error("must not be called"); },
        unprotect: async () => { throw new Error("must not be called"); },
      },
    });

    const result = await service.bootstrapSession(authenticatedUser, "session-1");

    expect(result.matrix).toEqual({
      status: "unavailable",
      reason: "SYNAPSE_NOT_CONFIGURED",
    });
    expect(repository.profiles.size).toBe(1);
    expect(repository.identities.size).toBe(0);
    expect(repository.bindings.size).toBe(0);
  });

  it("is idempotent across concurrent user and session-device bootstrap", async () => {
    const { repository, service, synapse, tokenProtector } = createReadyService();
    const [first, second] = await Promise.all([
      service.bootstrapSession(authenticatedUser, "session-1"),
      service.bootstrapSession(authenticatedUser, "session-1"),
    ]);

    expect(first).toEqual(second);
    expect(synapse.users.size).toBe(1);
    expect(synapse.devices).toHaveLength(2);
    expect(synapse.revokedDevices).toHaveLength(1);
    expect(repository.identities.size).toBe(1);
    expect(repository.bindings.size).toBe(1);
    const [binding] = repository.bindings.values();
    expect(binding.matrixAccessTokenCiphertext).not.toContain("secret_session-1");
    expect(tokenProtector.protectedValues).toEqual([
      "secret_session-1_1",
      "secret_session-1_2",
    ]);
    expect(synapse.revokedDevices[0].deviceId).not.toBe(binding.matrixDeviceId);
  });

  it("does not persist a half-active binding when device provisioning fails", async () => {
    const { repository, service, synapse } = createReadyService();
    synapse.failDeviceProvision = true;

    await expect(service.bootstrapSession(authenticatedUser, "session-1"))
      .rejects.toThrow("device provision failed");
    expect(repository.identities.size).toBe(1);
    expect(repository.bindings.size).toBe(0);
  });

  it("revokes a binding and enqueues one idempotent outbox event", async () => {
    const { repository, service } = createReadyService();
    await service.bootstrapSession(authenticatedUser, "session-1");

    const first = await service.revokeSession("session-1");
    const second = await service.revokeSession("session-1");

    expect(first?.revokedAt).toEqual(new Date("2026-08-11T08:00:00.000Z"));
    expect(second?.revokedAt).toEqual(first?.revokedAt);
    expect(repository.outbox.size).toBe(1);
    expect([...repository.outbox.values()][0]).toMatchObject({
      eventType: "matrix.device.revoke",
      aggregateId: "session-1",
      payload: {
        matrixDeviceId: "DEVICE_session-1_1",
      },
    });
  });
});
