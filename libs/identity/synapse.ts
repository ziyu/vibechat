import type { SynapseAdapter } from "./contracts";

export class UnavailableSynapseAdapter implements SynapseAdapter {
  availability() {
    return {
      available: false as const,
      reason: "SYNAPSE_NOT_CONFIGURED" as const,
    };
  }

  async ensureUser(): Promise<never> {
    throw new Error("Synapse is not configured");
  }

  async createSessionDevice(): Promise<never> {
    throw new Error("Synapse is not configured");
  }

  async revokeDevice(): Promise<never> {
    throw new Error("Synapse is not configured");
  }
}
