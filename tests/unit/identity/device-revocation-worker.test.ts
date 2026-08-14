import { describe, expect, it, vi } from "vitest";
import type {
  IdentityRepository,
  MatrixTokenProtector,
  SynapseAdapter,
} from "@libs/identity/contracts";
import { MatrixDeviceRevocationWorker } from "@libs/identity/device-revocation-worker";
import type {
  IntegrationOutboxRecord,
  MatrixIdentityRecord,
  MatrixSessionBindingRecord,
  ProductProfile,
} from "@libs/identity/types";

class WorkerRepository implements IdentityRepository {
  binding: MatrixSessionBindingRecord | null;
  events: IntegrationOutboxRecord[];

  constructor(options: {
    binding?: MatrixSessionBindingRecord | null;
    events: IntegrationOutboxRecord[];
  }) {
    this.binding = options.binding ?? null;
    this.events = options.events;
  }

  async ensureProfile(profile: ProductProfile) { return profile; }
  async getMatrixIdentity(_userId: string): Promise<MatrixIdentityRecord | null> { return null; }
  async ensureMatrixIdentity(identity: MatrixIdentityRecord) { return identity; }
  async getSessionBinding(authSessionId: string) {
    return this.binding?.authSessionId === authSessionId ? this.binding : null;
  }
  async ensureSessionBinding(binding: MatrixSessionBindingRecord) {
    this.binding = binding;
    return { binding, created: true };
  }
  async revokeSessionBinding(
    _authSessionId: string,
    _revokedAt: Date,
    _outboxEvent: IntegrationOutboxRecord,
  ) { return this.binding; }
  async listPendingOutboxEvents(availableAt: Date, limit: number) {
    return this.events
      .filter((event) => !event.processedAt && event.availableAt <= availableAt)
      .slice(0, limit);
  }
  async markOutboxEventProcessed(eventId: string, processedAt: Date) {
    this.events = this.events.map((event) =>
      event.id === eventId ? { ...event, processedAt } : event,
    );
  }
  async rescheduleOutboxEvent(eventId: string, attempts: number, availableAt: Date) {
    this.events = this.events.map((event) =>
      event.id === eventId ? { ...event, attempts, availableAt } : event,
    );
  }
}

const now = new Date("2026-08-11T12:00:00.000Z");
const binding: MatrixSessionBindingRecord = {
  authSessionId: "auth-session-1",
  userId: "user-1",
  matrixUserId: "@vibe_user_1:localhost",
  matrixDeviceId: "DEVICE_1",
  matrixAccessTokenCiphertext: "ciphertext-only",
  createdAt: now,
  revokedAt: now,
};
const event: IntegrationOutboxRecord = {
  id: "event-1",
  eventType: "matrix.device.revoke",
  aggregateId: binding.authSessionId,
  payload: {
    matrixUserId: binding.matrixUserId,
    matrixDeviceId: binding.matrixDeviceId,
  },
  attempts: 0,
  availableAt: now,
  processedAt: null,
};

function createWorker(options: {
  repository: WorkerRepository;
  revokeDevice?: SynapseAdapter["revokeDevice"];
}) {
  const unprotect = vi.fn<MatrixTokenProtector["unprotect"]>(async () => "matrix-secret-token");
  const revokeDevice = vi.fn<SynapseAdapter["revokeDevice"]>(
    options.revokeDevice || (async () => undefined),
  );
  const worker = new MatrixDeviceRevocationWorker({
    repository: options.repository,
    tokenProtector: {
      protect: async () => { throw new Error("not used"); },
      unprotect,
    },
    synapse: {
      availability: () => ({ available: true, homeserverUrl: "http://localhost:8008" }),
      ensureUser: async () => { throw new Error("not used"); },
      createSessionDevice: async () => { throw new Error("not used"); },
      revokeDevice,
    },
    now: () => now,
    retryDelayMs: () => 5_000,
  });

  return { revokeDevice, unprotect, worker };
}

describe("MatrixDeviceRevocationWorker", () => {
  it("decrypts the binding token, revokes the device, and completes the event", async () => {
    const repository = new WorkerRepository({ binding, events: [event] });
    const { revokeDevice, unprotect, worker } = createWorker({ repository });

    await expect(worker.drain()).resolves.toEqual({
      scanned: 1,
      processed: 1,
      retried: 0,
      skipped: 0,
    });
    expect(unprotect).toHaveBeenCalledWith("ciphertext-only");
    expect(revokeDevice).toHaveBeenCalledWith({
      matrixUserId: binding.matrixUserId,
      deviceId: binding.matrixDeviceId,
      accessToken: "matrix-secret-token",
    });
    expect(repository.events[0].processedAt).toEqual(now);
    expect(JSON.stringify(repository.events)).not.toContain("matrix-secret-token");
  });

  it("reschedules transient failures without exposing credentials in its result", async () => {
    const repository = new WorkerRepository({ binding, events: [event] });
    const { worker } = createWorker({
      repository,
      revokeDevice: async () => { throw new Error("temporary matrix failure"); },
    });

    const result = await worker.drain();

    expect(result).toEqual({ scanned: 1, processed: 0, retried: 1, skipped: 0 });
    expect(repository.events[0]).toMatchObject({
      attempts: 1,
      availableAt: new Date(now.getTime() + 5_000),
      processedAt: null,
    });
    expect(JSON.stringify(result)).not.toContain("matrix-secret-token");
  });

  it("completes orphaned events without calling Matrix", async () => {
    const repository = new WorkerRepository({ events: [event] });
    const { revokeDevice, unprotect, worker } = createWorker({ repository });

    await expect(worker.drain()).resolves.toEqual({
      scanned: 1,
      processed: 0,
      retried: 0,
      skipped: 1,
    });
    expect(unprotect).not.toHaveBeenCalled();
    expect(revokeDevice).not.toHaveBeenCalled();
    expect(repository.events[0].processedAt).toEqual(now);
  });
});
