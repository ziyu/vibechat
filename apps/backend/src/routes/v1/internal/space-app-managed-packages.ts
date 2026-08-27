import { createFileRoute } from "@tanstack/react-router";
import {
  DatabaseManagedPackageReleaseStore,
  ManagedPackageObjectUnavailableError,
  ManagedPackageReleaseConflictError,
  ManagedPackageResolutionIntegrityError,
  publishSpaceAppManagedPackage,
  resolveSpaceAppManagedPackage,
} from "@libs/space-app-registry";
import {
  parseSpaceAppManagedPackageObject,
  parseSpaceAppManagedPackageResolution,
  serializeSpaceAppManagedPackageObject,
} from "@vibechat/space-app-dependencies";
import { authorizeSpaceAppPackagePublisher } from "@/lib/space-app-package-publisher-auth";
import { authorizeSpaceRuntimeCallback } from "@/lib/space-runtime-callback-auth";
import { getSpaceRuntimeObjectStore } from "@/lib/space-runtime-object-store";
import { withCfDb } from "@/lib/with-request-db";

const maximumManagedPackageBytes = 3 * 1024 * 1024;

export const Route = createFileRoute(
  "/v1/internal/space-app-managed-packages",
)({
  server: {
    handlers: {
      POST: withCfDb(async ({ request }) => {
        if (!await authorizeSpaceRuntimeCallback(request)) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }
        let resolution;
        try {
          resolution = parseSpaceAppManagedPackageResolution(
            await request.json().catch(() => null),
          );
        } catch {
          return Response.json(
            { error: "invalid_managed_package_resolution" },
            { status: 400 },
          );
        }
        try {
          const artifact = await resolveSpaceAppManagedPackage({
            request: resolution,
            releases: new DatabaseManagedPackageReleaseStore(),
            objects: await getSpaceRuntimeObjectStore(),
          });
          if (!artifact) {
            return Response.json(
              { error: "managed_package_not_found" },
              { status: 404 },
            );
          }
          return new Response(serializeSpaceAppManagedPackageObject(artifact), {
            headers: {
              "cache-control": "private, no-store",
              "content-type": "application/vnd.vibechat.space-app-managed-package+json; charset=utf-8",
              "x-content-type-options": "nosniff",
            },
          });
        } catch (error) {
          if (error instanceof ManagedPackageObjectUnavailableError) {
            return Response.json({ error: error.code }, { status: 502 });
          }
          if (error instanceof ManagedPackageResolutionIntegrityError) {
            return Response.json({ error: error.code }, { status: 409 });
          }
          throw error;
        }
      }),
      PUT: withCfDb(async ({ request }) => {
        if (!await authorizeSpaceAppPackagePublisher(request)) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }
        const declaredLength = Number(request.headers.get("content-length") || 0);
        if (declaredLength > maximumManagedPackageBytes) {
          return Response.json({ error: "managed_package_too_large" }, { status: 413 });
        }
        const content = await request.text();
        if (new TextEncoder().encode(content).byteLength > maximumManagedPackageBytes) {
          return Response.json({ error: "managed_package_too_large" }, { status: 413 });
        }
        let object;
        try {
          object = parseSpaceAppManagedPackageObject(content);
        } catch {
          return Response.json(
            { error: "invalid_managed_package_object" },
            { status: 400 },
          );
        }
        try {
          const result = await publishSpaceAppManagedPackage({
            artifact: object,
            releases: new DatabaseManagedPackageReleaseStore(),
            objects: await getSpaceRuntimeObjectStore(),
          });
          return Response.json({
            created: result.created,
            release: {
              ...result.release,
              createdAt: result.release.createdAt.toISOString(),
            },
          }, { status: result.created ? 201 : 200 });
        } catch (error) {
          if (error instanceof ManagedPackageReleaseConflictError) {
            return Response.json({ error: error.code }, { status: 409 });
          }
          throw error;
        }
      }),
    },
  },
});
