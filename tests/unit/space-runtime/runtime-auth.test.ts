import { describe, expect, it } from "vitest";
import {
  signSpaceRuntimeCredential,
  spaceAppPackageRegistryAudience,
  spaceBackendCallbackAudience,
  spaceRuntimeAudience,
  verifySpaceRuntimeCredential,
} from "../../../packages/space-runtime-auth/src/index";

const secret = "test-space-runtime-signing-secret-32";
const issuedAt = new Date("2026-08-26T00:00:00.000Z");

describe("Space Runtime short-lived credentials", () => {
  it("binds credentials to audience, method, path, subject and expiry", async () => {
    const credential = await signSpaceRuntimeCredential({
      secret,
      audience: spaceRuntimeAudience,
      subject: "vibechat-backend",
      method: "POST",
      path: "/api/apps/space-1/publish",
      ttlSeconds: 30,
      now: issuedAt,
      credentialId: "credential-1",
    });

    await expect(verifySpaceRuntimeCredential(credential, {
      secret,
      audience: spaceRuntimeAudience,
      subject: "vibechat-backend",
      method: "POST",
      path: "/api/apps/space-1/publish",
      now: new Date("2026-08-26T00:00:20.000Z"),
    })).resolves.toMatchObject({ credentialId: "credential-1" });
    await expect(verifySpaceRuntimeCredential(credential, {
      secret,
      audience: spaceBackendCallbackAudience,
      method: "POST",
      path: "/api/apps/space-1/publish",
      now: issuedAt,
    })).resolves.toBeNull();
    await expect(verifySpaceRuntimeCredential(credential, {
      secret,
      audience: spaceRuntimeAudience,
      method: "GET",
      path: "/api/apps/space-1/publish",
      now: issuedAt,
    })).resolves.toBeNull();
    await expect(verifySpaceRuntimeCredential(credential, {
      secret,
      audience: spaceRuntimeAudience,
      method: "POST",
      path: "/api/apps/space-2/publish",
      now: issuedAt,
    })).resolves.toBeNull();
    await expect(verifySpaceRuntimeCredential(credential, {
      secret,
      audience: spaceRuntimeAudience,
      method: "POST",
      path: "/api/apps/space-1/publish",
      now: new Date("2026-08-26T00:00:40.000Z"),
      clockSkewSeconds: 0,
    })).resolves.toBeNull();
  });

  it("keeps package publication credentials separate from Runtime callbacks", async () => {
    const credential = await signSpaceRuntimeCredential({
      secret,
      audience: spaceAppPackageRegistryAudience,
      subject: "space-app-package-publisher",
      method: "PUT",
      path: "/v1/internal/space-app-managed-packages",
      now: issuedAt,
    });

    await expect(verifySpaceRuntimeCredential(credential, {
      secret,
      audience: spaceAppPackageRegistryAudience,
      subject: "space-app-package-publisher",
      method: "PUT",
      path: "/v1/internal/space-app-managed-packages",
      now: issuedAt,
    })).resolves.toBeTruthy();
    await expect(verifySpaceRuntimeCredential(credential, {
      secret,
      audience: spaceBackendCallbackAudience,
      subject: "space-runtime",
      method: "PUT",
      path: "/v1/internal/space-app-managed-packages",
      now: issuedAt,
    })).resolves.toBeNull();
  });
});
