import {
  serializeSpaceAppManagedPackageObject,
} from "@vibechat/space-app-dependencies";
import {
  signSpaceRuntimeCredential,
  spaceAppPackageRegistryAudience,
} from "@vibechat/space-runtime-auth";
import {
  getCurrentSpaceAppComponentManagedRelease,
  loadSpaceAppComponentManagedPackage,
} from "../src/node.ts";

const registryPath = "/v1/internal/space-app-managed-packages";
const requestedVersion = process.argv[2];
const currentRelease = getCurrentSpaceAppComponentManagedRelease();
const version = requestedVersion || currentRelease.version;
const origin = process.env.SPACE_APP_PACKAGE_REGISTRY_ORIGIN?.trim();
const publishingSecret = process.env.SPACE_APP_PACKAGE_PUBLISHING_TOKEN?.trim();

if (!origin || !publishingSecret) {
  throw new Error(
    "Managed publish requires SPACE_APP_PACKAGE_REGISTRY_ORIGIN and SPACE_APP_PACKAGE_PUBLISHING_TOKEN",
  );
}

const artifact = await loadSpaceAppComponentManagedPackage(version);
const credential = await signSpaceRuntimeCredential({
  secret: publishingSecret,
  audience: spaceAppPackageRegistryAudience,
  subject: "space-app-package-publisher",
  method: "PUT",
  path: registryPath,
  ttlSeconds: 60,
});
const response = await fetch(new URL(registryPath, origin), {
  method: "PUT",
  headers: {
    authorization: `Bearer ${credential}`,
    "content-type": "application/vnd.vibechat.space-app-managed-package+json; charset=utf-8",
  },
  body: serializeSpaceAppManagedPackageObject(artifact),
});
const body = await response.json().catch(() => null);
if (!response.ok) {
  throw new Error(
    `Managed package publish returned ${response.status}: ${JSON.stringify(body)}`,
  );
}
const release = body?.release;
if (
  !release
  || release.name !== artifact.name
  || release.version !== artifact.version
  || release.integrity !== artifact.integrity
) {
  throw new Error("Managed package publish returned a mismatched release");
}

process.stdout.write(
  `${body.created ? "Published" : "Verified"} ${artifact.name}@${artifact.version} ${artifact.integrity} as ${release.objectKey}\n`,
);
