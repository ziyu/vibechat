import {
  signSpaceRuntimeCredential,
  spaceAppPackageRegistryAudience,
  spaceBackendCallbackAudience,
} from "@vibechat/space-runtime-auth";
import { afterEach, describe, expect, it } from "vitest";
import { authorizeSpaceAppPackagePublisher } from "../../../apps/backend/src/lib/space-app-package-publisher-auth";

const originalToken = process.env.SPACE_APP_PACKAGE_PUBLISHING_TOKEN;

afterEach(() => {
  if (originalToken === undefined) delete process.env.SPACE_APP_PACKAGE_PUBLISHING_TOKEN;
  else process.env.SPACE_APP_PACKAGE_PUBLISHING_TOKEN = originalToken;
});

describe("Space App managed package publisher authorization", () => {
  it("accepts only the dedicated publisher audience and subject", async () => {
    const secret = "p".repeat(64);
    const path = "/v1/internal/space-app-managed-packages";
    process.env.SPACE_APP_PACKAGE_PUBLISHING_TOKEN = secret;
    const publisher = await signSpaceRuntimeCredential({
      secret,
      audience: spaceAppPackageRegistryAudience,
      subject: "space-app-package-publisher",
      method: "PUT",
      path,
    });
    const runtime = await signSpaceRuntimeCredential({
      secret,
      audience: spaceBackendCallbackAudience,
      subject: "space-runtime",
      method: "PUT",
      path,
    });

    await expect(authorizeSpaceAppPackagePublisher(new Request(
      `https://backend.test${path}`,
      { method: "PUT", headers: { authorization: `Bearer ${publisher}` } },
    ))).resolves.toBe(true);
    await expect(authorizeSpaceAppPackagePublisher(new Request(
      `https://backend.test${path}`,
      { method: "PUT", headers: { authorization: `Bearer ${runtime}` } },
    ))).resolves.toBe(false);
  });
});
