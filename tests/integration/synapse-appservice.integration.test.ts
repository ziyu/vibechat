import { describe, expect, it } from "vitest";
import { SynapseAppserviceAdapter } from "@libs/identity/synapse-appservice";

const runIntegration = process.env.RUN_SYNAPSE_INTEGRATION === "1";

describe.runIf(runIntegration)("Synapse Appservice integration", () => {
  it("registers a user, creates a real device token, and logs it out", async () => {
    const homeserverUrl = process.env.MATRIX_HOMESERVER_URL || "http://localhost:8008";
    const adapter = new SynapseAppserviceAdapter({
      homeserverUrl,
      publicHomeserverUrl: homeserverUrl,
      serverName: process.env.MATRIX_SERVER_NAME || "localhost",
      appserviceToken:
        process.env.MATRIX_APPSERVICE_TOKEN || "vibechat-local-appservice-token",
      userPrefix: process.env.MATRIX_USER_PREFIX || "vibe_",
    });
    const suffix = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}`.toLowerCase();
    const { matrixUserId } = await adapter.ensureUser({
      externalUserId: `integration-${suffix}`,
      localpart: `integration_${suffix}`,
      displayName: "VibeChat Integration",
    });
    const credentials = await adapter.createSessionDevice({
      matrixUserId,
      authSessionId: `session-${suffix}`,
      displayName: "VibeChat Integration Device",
    });

    const whoami = await fetch(`${homeserverUrl}/_matrix/client/v3/account/whoami`, {
      headers: { authorization: `Bearer ${credentials.accessToken}` },
    });
    expect(whoami.ok).toBe(true);
    await expect(whoami.json()).resolves.toMatchObject({
      user_id: matrixUserId,
      device_id: credentials.deviceId,
    });

    await adapter.revokeDevice({
      matrixUserId,
      deviceId: credentials.deviceId,
      accessToken: credentials.accessToken,
    });
    const revokedWhoami = await fetch(
      `${homeserverUrl}/_matrix/client/v3/account/whoami`,
      { headers: { authorization: `Bearer ${credentials.accessToken}` } },
    );
    expect(revokedWhoami.status).toBe(401);
  });
});
