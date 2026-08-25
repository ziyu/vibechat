import { describe, expect, it } from "vitest";
import {
  addAgentUsage,
  splitAgentUsage,
} from "../../../apps/space-runtime/src/agent-usage";

describe("Space Agent usage accounting", () => {
  it("accumulates initial and repair turn usage", () => {
    expect(
      addAgentUsage(
        { inputTokens: 3_000, outputTokens: 100, totalTokens: 3_100 },
        { inputTokens: 1_000, outputTokens: 80, totalTokens: 1_080 },
      ),
    ).toEqual({ inputTokens: 4_000, outputTokens: 180, totalTokens: 4_180 });
  });

  it("distributes every token exactly once across a batched turn", () => {
    const parts = splitAgentUsage(
      { inputTokens: 3_649, outputTokens: 52, totalTokens: 3_701 },
      2,
    );
    expect(parts).toEqual([
      { inputTokens: 1_825, outputTokens: 26, totalTokens: 1_851 },
      { inputTokens: 1_824, outputTokens: 26, totalTokens: 1_850 },
    ]);
  });
});
