import { gzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  assertSpaceComponentBundle,
  getCurrentSpaceAppComponentManagedRelease,
  loadSpaceAppComponentManagedPackage,
} from "../dist/esm/node.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = join(packageRoot, "dist");
const publishedPackageRoot = join(distRoot, "package");
const manifest = JSON.parse(await readFile(join(distRoot, "manifest.json"), "utf8"));
const files = Object.fromEntries(await Promise.all(
  manifest.exports.map(async (path) => [
    path,
    await readFile(join(distRoot, "bundles", path), "utf8"),
  ]),
));
const catalog = await readFile(join(distRoot, "catalog.html"), "utf8");
const bundle = { manifest, files };
const managedRelease = getCurrentSpaceAppComponentManagedRelease();
const managedPackage = await loadSpaceAppComponentManagedPackage(
  managedRelease.version,
);
const publishedPackageJson = JSON.parse(
  await readFile(join(publishedPackageRoot, "package.json"), "utf8"),
);
const requiredSemanticExports = [
  "./foundation",
  "./user",
  "./agent",
  "./chat",
  "./chat/inline",
  "./recipes",
  "./recipes/inline",
  "./register",
  "./register/foundation",
  "./register/user",
  "./register/agent",
  "./register/chat",
];
const expectedSideEffects = [
  "./browser.js",
  "./foundation/browser.js",
  "./user/browser.js",
  "./agent/browser.js",
  "./chat/browser.js",
];

assertSpaceComponentBundle(bundle);
if (
  managedRelease.packageFormat !== "npm-package-v1"
  || managedRelease.componentBundle.sourceHash !== manifest.sourceHash
  || managedRelease.componentBundle.artifactHash !== manifest.artifactHash
  || managedPackage.integrity !== managedRelease.integrity
) {
  throw new Error("Managed component release is not bound to the publishable package");
}
if (
  publishedPackageJson.name !== "@vibechat/space-app-components"
  || publishedPackageJson.version !== managedRelease.version
  || publishedPackageJson.private === true
  || requiredSemanticExports.some(
    (path) => publishedPackageJson.exports?.[path] === undefined,
  )
  || Object.keys(publishedPackageJson.exports ?? {}).some((path) =>
    path.includes("artifact") || path.includes(managedRelease.version)
  )
) {
  throw new Error("Published component package exports are not semantic and version-independent");
}
if (JSON.stringify(publishedPackageJson.sideEffects) !== JSON.stringify(expectedSideEffects)) {
  throw new Error("Only explicit component registration entries may have package side effects");
}
const chatModule = await import(
  pathToFileURL(join(publishedPackageRoot, "chat", "index.js"))
);
for (const requiredExport of [
  "createSpaceChatController",
  "createSpaceComponentContext",
  "spaceChatEventNames",
]) {
  if (!(requiredExport in chatModule)) {
    throw new Error(`Published component /chat entry is missing ${requiredExport}`);
  }
}
const agentModule = await import(
  pathToFileURL(join(publishedPackageRoot, "agent", "index.js"))
);
for (const requiredExport of [
  "createSpaceAgentActivityView",
  "createSpaceAgentController",
  "defineSpaceAgentActivityElements",
  "renderSpaceAgentActivity",
  "renderSpaceAgentQueueStatus",
]) {
  if (!(requiredExport in agentModule)) {
    throw new Error(`Published component /agent entry is missing ${requiredExport}`);
  }
}
const inlineModule = await import(
  pathToFileURL(join(publishedPackageRoot, "chat", "inline.js"))
);
if (
  inlineModule.spaceChatInlineModule?.packageVersion !== managedRelease.version
  || inlineModule.spaceChatInlineModule?.bundleHash !== manifest.artifactHash
  || inlineModule.spaceChatInlineModule?.source !== files["chat.js"]
) {
  throw new Error("Published component /chat/inline entry is not bound to the Chat bundle");
}
const recipesModule = await import(
  pathToFileURL(join(publishedPackageRoot, "recipes", "index.js"))
);
for (const requiredExport of [
  "mountAgentActivityPanelRecipe",
  "mountDefaultChatRecipe",
  "mountChatDrawerRecipe",
  "resolveSpaceChatRecipeElements",
]) {
  if (!(requiredExport in recipesModule)) {
    throw new Error(`Published component /recipes entry is missing ${requiredExport}`);
  }
}
const recipesInlineModule = await import(
  pathToFileURL(join(publishedPackageRoot, "recipes", "inline.js"))
);
if (
  recipesInlineModule.spaceRecipesInlineModule?.packageVersion !== managedRelease.version
  || recipesInlineModule.spaceRecipesInlineModule?.bundleHash !== manifest.artifactHash
  || recipesInlineModule.spaceRecipesInlineModule?.source !== files["recipes.js"]
) {
  throw new Error("Published component /recipes/inline entry is not bound to the Recipe bundle");
}
for (const requiredElementName of [
  "vc-space-agent-activity",
  "vc-space-agent-queue-status",
  "vc-space-chat-timeline",
  "vc-space-chat-composer",
  "vc-space-mention-menu",
  "vc-space-chat-error-state",
]) {
  if (!recipesInlineModule.spaceRecipesInlineModule.source.includes(requiredElementName)) {
    throw new Error(
      `Published component /recipes/inline does not register ${requiredElementName}`,
    );
  }
}
for (const [path, source] of Object.entries(files)) {
  const networkInspectableSource = source.replaceAll(
    "http://www.w3.org/2000/svg",
    "",
  );
  if (/\bhttps?:\/\//.test(networkInspectableSource)) {
    throw new Error(`Space component browser bundle ${path} contains a remote URL`);
  }
  if (source.includes("/v1/space-app-sdk")) {
    throw new Error(`Space component browser bundle ${path} must receive the SDK through injection`);
  }
}
if (!catalog.includes(manifest.artifactHash)) {
  throw new Error("Space component catalog is not bound to the bundle artifact hash");
}

const budgets = {
  "browser.js": 35 * 1024,
  "foundation.js": 20 * 1024,
  "user.js": 20 * 1024,
  "agent.js": 20 * 1024,
  "chat.js": 35 * 1024,
  "recipes.js": 35 * 1024,
};
const sizes = Object.fromEntries(Object.entries(files).map(([path, source]) => [
  path,
  gzipSync(source).byteLength,
]));
for (const [path, budgetBytes] of Object.entries(budgets)) {
  if (sizes[path] > budgetBytes) {
    throw new Error(`Space component ${path} exceeds ${budgetBytes} gzip bytes: ${sizes[path]}`);
  }
}

process.stdout.write(
  `Space component package verified: ${Object.entries(sizes).map(([path, bytes]) => `${path}=${bytes}`).join(", ")} gzip bytes; managed package ${managedRelease.integrity}; semantic exports and no remote runtime imports.\n`,
);
