import type { AppReleaseScaling } from "../app-runtime/contract.js";

export const defaultSpaceReleaseScaling: AppReleaseScaling = {
  minReplicas: 0,
  maxReplicas: 16,
  targetConcurrency: 4,
};
