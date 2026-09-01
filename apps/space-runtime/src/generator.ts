/**
 * Compatibility façade for the pre-S1 generator module.
 * New code should import the concrete adapter modules under adapters/pi/.
 */
export type {
  GeneratedRevision,
  GenerationProgress,
  ProjectTurnResult,
  SpaceAgentTurnInput,
} from "./adapters/contract.js";
export {
  createPiAgentAdapter,
  reviseProject,
  runProjectTurn,
} from "./adapters/pi/adapter.js";
export {
  configuredProvider,
  hasModelCredentials,
  piMode,
} from "./adapters/pi/config.js";
export { collaborationInstructions } from "./adapters/pi/prompt.js";
export { loadSeed } from "./adapters/pi/project-workspace.js";
export { hostPiSessionId } from "./adapters/pi/session.js";
