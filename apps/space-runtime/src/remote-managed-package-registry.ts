import {
  parseSpaceAppManagedPackageObject,
  type SpaceAppManagedPackageRegistry,
} from "@vibechat/space-app-dependencies";
import {
  signSpaceRuntimeCredential,
  spaceBackendCallbackAudience,
} from "@vibechat/space-runtime-auth";

const managedPackagePath = "/v1/internal/space-app-managed-packages";

export function createRemoteSpaceAppManagedPackageRegistryFromEnv():
SpaceAppManagedPackageRegistry {
  return Object.freeze({
    async resolve(
      input: Parameters<SpaceAppManagedPackageRegistry["resolve"]>[0],
    ) {
      const origin = process.env.SPACE_RUNTIME_CALLBACK_ORIGIN?.trim();
      const signingSecret = process.env.SPACE_RUNTIME_INTERNAL_TOKEN?.trim();
      if (!origin || !signingSecret) {
        throw new Error(
          "Space Runtime managed Registry requires SPACE_RUNTIME_CALLBACK_ORIGIN and SPACE_RUNTIME_INTERNAL_TOKEN",
        );
      }
      const credential = await signSpaceRuntimeCredential({
        secret: signingSecret,
        audience: spaceBackendCallbackAudience,
        subject: "space-runtime",
        method: "POST",
        path: managedPackagePath,
        ttlSeconds: 60,
      });
      const response = await fetch(new URL(managedPackagePath, origin), {
        method: "POST",
        headers: {
          authorization: `Bearer ${credential}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(input),
      });
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new RemoteManagedPackageRegistryError(
          `Managed package Registry returned ${response.status}`,
          response.status,
        );
      }
      let object;
      try {
        object = parseSpaceAppManagedPackageObject(await response.text());
      } catch {
        throw new RemoteManagedPackageRegistryError(
          "Managed package Registry returned an invalid object",
          response.status,
        );
      }
      if (
        object.name !== input.name
        || object.version !== input.version
        || object.integrity !== input.integrity
        || !object.projectFormats.includes(input.projectFormat)
      ) {
        throw new RemoteManagedPackageRegistryError(
          `Managed package Registry returned mismatched ${input.name}@${input.version}`,
          response.status,
        );
      }
      return Object.freeze({
        name: object.name,
        version: object.version,
        integrity: object.integrity,
        projectFormats: object.projectFormats,
        files: object.files,
      });
    },
  });
}

export class RemoteManagedPackageRegistryError extends Error {
  readonly code = "space_app_remote_managed_package_registry_error";

  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "RemoteManagedPackageRegistryError";
  }
}
