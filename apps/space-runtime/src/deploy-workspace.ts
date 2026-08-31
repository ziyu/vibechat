import { assertAppId } from "./app-id.js";
import { AgentOsAppExecutionRuntime } from "./app-runtime/agentos/app-runtime.js";
import { loadProject, saveProject } from "./project-store.js";
import { ReleaseManager } from "./release-manager/release-manager.js";

const sourceAppId = process.argv[2];
const appId = process.argv[3] ?? sourceAppId;
if (!sourceAppId || !appId) {
  throw new Error(
    "Usage: npm run deploy:project -- <source-app-id> [target-app-id]",
  );
}
assertAppId(sourceAppId);
assertAppId(appId);
process.env.RIVET_ENDPOINT ??=
  process.env.AGENTOS_ENDPOINT ?? "http://127.0.0.1:6420";

const project = await loadProject(sourceAppId);
if (!project) throw new Error(`No saved project found for ${sourceAppId}`);
const files = project.files;

const deployment = await new ReleaseManager(
  new AgentOsAppExecutionRuntime(),
).deploy({
  spaceInstanceId: appId,
  files,
  onProgress: async () => undefined,
});
await saveProject({
  appId,
  files,
  summary: `${project.summary}\n\n已从本地项目快照重新发布。`,
  updatedAt: new Date().toISOString(),
  releaseId: deployment.releaseId,
});
console.log(JSON.stringify(deployment.deployment, null, 2));
