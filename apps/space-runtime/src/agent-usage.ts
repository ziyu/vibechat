import type { AgentTokenUsage, AgentUsageV1 } from "@vibechat/space-agent-contracts";

export type AgentUsage = AgentTokenUsage;

export function versionAgentUsage(usage: AgentUsage): AgentUsageV1 {
  return {
    schemaVersion: "vibechat.agent-usage/v1",
    unit: "tokens",
    ...usage,
  };
}

export function addAgentUsage(
  left?: AgentUsage,
  right?: AgentUsage,
): AgentUsage | undefined {
  if (!left) return right;
  if (!right) return left;
  return {
    inputTokens: (left.inputTokens ?? 0) + (right.inputTokens ?? 0),
    outputTokens: (left.outputTokens ?? 0) + (right.outputTokens ?? 0),
    totalTokens: (left.totalTokens ?? 0) + (right.totalTokens ?? 0),
  };
}

export function splitAgentUsage(usage: AgentUsage | undefined, parts: number) {
  if (!usage || parts <= 0) return Array.from({ length: Math.max(parts, 0) }, () => ({}));
  return Array.from({ length: parts }, (_, index) => ({
    ...splitField("inputTokens", usage.inputTokens, parts, index),
    ...splitField("outputTokens", usage.outputTokens, parts, index),
    ...splitField("totalTokens", usage.totalTokens, parts, index),
  }));
}

function splitField(
  key: keyof AgentUsage,
  value: number | undefined,
  parts: number,
  index: number,
) {
  if (value === undefined) return {};
  const quotient = Math.floor(value / parts);
  return { [key]: quotient + (index < value % parts ? 1 : 0) };
}
