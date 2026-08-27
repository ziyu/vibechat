import type { SpaceAgentAdapter } from "./contract.js";

export class SpaceAgentAdapterRegistry {
  readonly #adapters = new Map<string, SpaceAgentAdapter>();

  constructor(adapters: Iterable<SpaceAgentAdapter>) {
    for (const adapter of adapters) {
      if (!adapter.id.trim()) throw new Error("Agent Adapter id is required");
      if (this.#adapters.has(adapter.id)) {
        throw new Error(`Duplicate Agent Adapter id: ${adapter.id}`);
      }
      this.#adapters.set(adapter.id, adapter);
    }
  }

  get(id: string) {
    return this.#adapters.get(id);
  }

  has(id: string) {
    return this.#adapters.has(id);
  }

  list() {
    return [...this.#adapters.values()].map((adapter) => ({
      id: adapter.id,
      name: adapter.name,
      available: adapter.isAvailable(),
    }));
  }
}
