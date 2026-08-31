export interface TurnSchedulerDependencies<TTurn> {
  maximumConcurrentTurns: number;
  turnBatchWindowMs: number;
  claimTurn(spaceInstanceId: string): Promise<TTurn | null>;
  executeTurn(spaceInstanceId: string, turn: TTurn): Promise<void>;
}

export class SpaceTurnScheduler<TTurn> {
  readonly #scheduledSpaceInstanceIds = new Set<string>();
  readonly #activeSpaceInstanceIds = new Set<string>();
  readonly #spaceScheduleTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();
  readonly #dependencies: TurnSchedulerDependencies<TTurn>;
  #drainingTurnQueue = false;

  constructor(dependencies: TurnSchedulerDependencies<TTurn>) {
    this.#dependencies = dependencies;
  }

  schedule(spaceInstanceId: string) {
    if (this.#activeSpaceInstanceIds.has(spaceInstanceId)) {
      this.#scheduledSpaceInstanceIds.add(spaceInstanceId);
      return;
    }
    if (
      this.#scheduledSpaceInstanceIds.has(spaceInstanceId) ||
      this.#spaceScheduleTimers.has(spaceInstanceId)
    ) {
      return;
    }

    const timer = setTimeout(() => {
      this.#spaceScheduleTimers.delete(spaceInstanceId);
      this.#scheduledSpaceInstanceIds.add(spaceInstanceId);
      void this.#drainTurnQueue();
    }, this.#dependencies.turnBatchWindowMs);
    this.#spaceScheduleTimers.set(spaceInstanceId, timer);
  }

  async #drainTurnQueue() {
    if (this.#drainingTurnQueue) return;
    this.#drainingTurnQueue = true;
    try {
      while (
        this.#activeSpaceInstanceIds.size <
        this.#dependencies.maximumConcurrentTurns
      ) {
        const spaceInstanceId = [...this.#scheduledSpaceInstanceIds].find(
          (candidate) => !this.#activeSpaceInstanceIds.has(candidate),
        );
        if (!spaceInstanceId) break;
        this.#scheduledSpaceInstanceIds.delete(spaceInstanceId);

        const turn = await this.#dependencies.claimTurn(spaceInstanceId);
        if (!turn) continue;
        this.#activeSpaceInstanceIds.add(spaceInstanceId);
        void this.#dependencies
          .executeTurn(spaceInstanceId, turn)
          .finally(() => {
            this.#activeSpaceInstanceIds.delete(spaceInstanceId);
            this.#scheduledSpaceInstanceIds.add(spaceInstanceId);
            void this.#drainTurnQueue();
          });
      }
    } finally {
      this.#drainingTurnQueue = false;
    }
  }
}
