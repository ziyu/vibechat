import type { SpaceAgentTurnInput } from "../contract.js";
import { turnPrompt } from "../pi/prompt.js";

export function claudeCodeTurnPrompt(input: SpaceAgentTurnInput) {
  return turnPrompt(input).replaceAll("Pi", "Claude Code");
}
