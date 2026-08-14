import type {
  IdentityRepository,
  MatrixTokenProtector,
  SynapseAdapter,
} from "./contracts";

export interface MatrixDeviceRevocationWorkerOptions {
  repository: IdentityRepository;
  synapse: SynapseAdapter;
  tokenProtector: MatrixTokenProtector;
  now?: () => Date;
  retryDelayMs?: (attempts: number) => number;
}

export interface MatrixDeviceRevocationDrainResult {
  scanned: number;
  processed: number;
  retried: number;
  skipped: number;
}

const defaultRetryDelayMs = (attempts: number) =>
  Math.min(60 * 60 * 1000, 1000 * 2 ** Math.min(attempts - 1, 12));

export class MatrixDeviceRevocationWorker {
  private readonly repository: IdentityRepository;
  private readonly synapse: SynapseAdapter;
  private readonly tokenProtector: MatrixTokenProtector;
  private readonly now: () => Date;
  private readonly retryDelayMs: (attempts: number) => number;

  constructor(options: MatrixDeviceRevocationWorkerOptions) {
    this.repository = options.repository;
    this.synapse = options.synapse;
    this.tokenProtector = options.tokenProtector;
    this.now = options.now || (() => new Date());
    this.retryDelayMs = options.retryDelayMs || defaultRetryDelayMs;
  }

  async drain(limit = 25): Promise<MatrixDeviceRevocationDrainResult> {
    const result: MatrixDeviceRevocationDrainResult = {
      scanned: 0,
      processed: 0,
      retried: 0,
      skipped: 0,
    };
    const now = this.now();
    const events = await this.repository.listPendingOutboxEvents(now, limit);

    for (const event of events) {
      result.scanned += 1;
      const binding = await this.repository.getSessionBinding(event.aggregateId);

      if (!binding) {
        await this.repository.markOutboxEventProcessed(event.id, now);
        result.skipped += 1;
        continue;
      }

      try {
        const accessToken = await this.tokenProtector.unprotect(
          binding.matrixAccessTokenCiphertext,
        );
        await this.synapse.revokeDevice({
          matrixUserId: binding.matrixUserId,
          deviceId: binding.matrixDeviceId,
          accessToken,
        });
        await this.repository.markOutboxEventProcessed(event.id, now);
        result.processed += 1;
      } catch (error) {
        const attempts = event.attempts + 1;
        await this.repository.rescheduleOutboxEvent(
          event.id,
          attempts,
          new Date(now.getTime() + this.retryDelayMs(attempts)),
        );
        console.warn("[matrix-device-revocation] Device revoke will be retried", {
          eventId: event.id,
          attempts,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
        result.retried += 1;
      }
    }

    return result;
  }
}
