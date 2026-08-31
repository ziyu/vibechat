import type { CompleteSpaceAgentAdapter } from "./contract.js";

export class SpaceAgentAdapterRegistry {
  readonly #adapters = new Map<string, CompleteSpaceAgentAdapter>();

  constructor(adapters: Iterable<CompleteSpaceAgentAdapter>) {
    for (const adapter of adapters) {
      if (!adapter.adapterKey.trim()) throw new Error("Agent Adapter key is required");
      if (this.#adapters.has(adapter.adapterKey)) {
        throw new Error(`Duplicate Agent Adapter id: ${adapter.adapterKey}`);
      }
      this.#adapters.set(adapter.adapterKey, adapter);
    }
  }

  get(adapterKey: string) {
    return this.#adapters.get(adapterKey);
  }

  has(adapterKey: string) {
    return this.#adapters.has(adapterKey);
  }

  list() {
    return [...this.#adapters.values()].map((adapter) => ({
      id: adapter.id,
      name: adapter.name,
      available: adapter.isAvailable(),
    }));
  }
}
