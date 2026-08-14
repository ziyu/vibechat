import { describe, expect, it, vi } from "vitest";
import { readMatrixRuntimeConfig } from "@libs/identity/config";
import {
  SynapseAdapterError,
  SynapseAppserviceAdapter,
} from "@libs/identity/synapse-appservice";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status });
}

function createAdapter(fetchImpl: typeof globalThis.fetch) {
  return new SynapseAppserviceAdapter({
    homeserverUrl: "http://synapse.internal:8008",
    publicHomeserverUrl: "https://matrix.example.com",
    serverName: "example.com",
    appserviceToken: "appservice-super-secret",
    userPrefix: "vibe_",
    fetch: fetchImpl,
  });
}

describe("Matrix runtime configuration", () => {
  it("is unavailable when every Matrix secret is absent", () => {
    expect(readMatrixRuntimeConfig({})).toEqual({
      status: "unavailable",
      reason: "SYNAPSE_NOT_CONFIGURED",
    });
  });

  it("rejects partial configuration without echoing secret values", () => {
    expect(() => readMatrixRuntimeConfig({
      MATRIX_HOMESERVER_URL: "http://localhost:8008",
      MATRIX_APPSERVICE_TOKEN: "must-never-appear-in-errors",
    })).toThrow("MATRIX_SERVER_NAME, MATRIX_TOKEN_ENCRYPTION_KEY");

    try {
      readMatrixRuntimeConfig({
        MATRIX_HOMESERVER_URL: "http://localhost:8008",
        MATRIX_APPSERVICE_TOKEN: "must-never-appear-in-errors",
      });
    } catch (error) {
      expect(String(error)).not.toContain("must-never-appear-in-errors");
    }
  });

  it("normalizes a complete server/private and browser/public configuration", () => {
    expect(readMatrixRuntimeConfig({
      MATRIX_HOMESERVER_URL: "http://synapse:8008/",
      MATRIX_PUBLIC_HOMESERVER_URL: "https://matrix.example.com/",
      MATRIX_SERVER_NAME: "example.com",
      MATRIX_APPSERVICE_TOKEN: "as-token",
      MATRIX_TOKEN_ENCRYPTION_KEY: "encryption-key",
    })).toEqual({
      status: "ready",
      homeserverUrl: "http://synapse:8008",
      publicHomeserverUrl: "https://matrix.example.com",
      serverName: "example.com",
      appserviceToken: "as-token",
      tokenEncryptionKey: "encryption-key",
      userPrefix: "vibe_",
    });
  });
});

describe("SynapseAppserviceAdapter", () => {
  it("registers a passwordless namespaced user and sets its display name", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ user_id: "@vibe_alice:example.com" }))
      .mockResolvedValueOnce(jsonResponse({}));
    const adapter = createAdapter(fetchMock as unknown as typeof globalThis.fetch);

    await expect(adapter.ensureUser({
      externalUserId: "product-user-1",
      localpart: "alice",
      displayName: "Alice",
    })).resolves.toEqual({ matrixUserId: "@vibe_alice:example.com" });

    const [registerUrl, registerInit] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(registerUrl.pathname).toBe("/_matrix/client/v3/register");
    expect(registerInit.method).toBe("POST");
    expect(registerInit.headers).toMatchObject({
      authorization: "Bearer appservice-super-secret",
    });
    expect(JSON.parse(String(registerInit.body))).toEqual({
      type: "m.login.application_service",
      username: "vibe_alice",
      inhibit_login: true,
    });

    const [profileUrl, profileInit] = fetchMock.mock.calls[1] as [URL, RequestInit];
    expect(profileUrl.pathname).toBe(
      "/_matrix/client/v3/profile/%40vibe_alice%3Aexample.com/displayname",
    );
    expect(profileUrl.searchParams.get("user_id")).toBe("@vibe_alice:example.com");
    expect(profileInit.method).toBe("PUT");
    expect(JSON.parse(String(profileInit.body))).toEqual({ displayname: "Alice" });
  });

  it("treats M_USER_IN_USE as an idempotent registration result", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ errcode: "M_USER_IN_USE" }, 400))
      .mockResolvedValueOnce(jsonResponse({}));
    const adapter = createAdapter(fetchMock as unknown as typeof globalThis.fetch);

    await expect(adapter.ensureUser({
      externalUserId: "product-user-1",
      localpart: "alice",
      displayName: "Alice",
    })).resolves.toEqual({ matrixUserId: "@vibe_alice:example.com" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("creates a unique real device through appservice scoped login", async () => {
    const issuedDeviceIds: string[] = [];
    const fetchMock = vi.fn(async (_url: URL, init: RequestInit) => {
      const request = JSON.parse(String(init.body));
      issuedDeviceIds.push(request.device_id);
      return jsonResponse({
        user_id: "@vibe_alice:example.com",
        device_id: request.device_id,
        access_token: `matrix-token-${issuedDeviceIds.length}`,
      });
    });
    const adapter = createAdapter(fetchMock as unknown as typeof globalThis.fetch);

    const first = await adapter.createSessionDevice({
      matrixUserId: "@vibe_alice:example.com",
      authSessionId: "auth-session-1",
      displayName: "VibeChat · alice",
    });
    const second = await adapter.createSessionDevice({
      matrixUserId: "@vibe_alice:example.com",
      authSessionId: "auth-session-1",
      displayName: "VibeChat · alice",
    });

    expect(first.deviceId).toMatch(/^VIBE_[A-F0-9]{24}$/);
    expect(second.deviceId).toMatch(/^VIBE_[A-F0-9]{24}$/);
    expect(second.deviceId).not.toBe(first.deviceId);
    const [, loginInit] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(JSON.parse(String(loginInit.body))).toMatchObject({
      type: "m.login.application_service",
      identifier: {
        type: "m.id.user",
        user: "@vibe_alice:example.com",
      },
      initial_device_display_name: "VibeChat · alice",
    });
  });

  it("logs out a device with its scoped token and accepts already-revoked tokens", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({ errcode: "M_UNKNOWN_TOKEN" }, 401));
    const adapter = createAdapter(fetchMock as unknown as typeof globalThis.fetch);

    await adapter.revokeDevice({
      matrixUserId: "@vibe_alice:example.com",
      deviceId: "VIBE_DEVICE",
      accessToken: "matrix-device-secret",
    });
    await adapter.revokeDevice({
      matrixUserId: "@vibe_alice:example.com",
      deviceId: "VIBE_DEVICE",
      accessToken: "matrix-device-secret",
    });

    const [logoutUrl, logoutInit] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(logoutUrl.pathname).toBe("/_matrix/client/v3/logout");
    expect(logoutInit.headers).toMatchObject({
      authorization: "Bearer matrix-device-secret",
    });
  });

  it("returns stable secret-free errors for invalid or rejected responses", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        errcode: "M_FORBIDDEN",
        error: "appservice-super-secret matrix-device-secret",
      }, 403));
    const adapter = createAdapter(fetchMock as unknown as typeof globalThis.fetch);

    let thrown: unknown;
    try {
      await adapter.createSessionDevice({
        matrixUserId: "@vibe_alice:example.com",
        authSessionId: "auth-session-1",
        displayName: "VibeChat · alice",
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(SynapseAdapterError);
    expect(thrown).toMatchObject({
      code: "SYNAPSE_HTTP_ERROR",
      status: 403,
      matrixErrorCode: "M_FORBIDDEN",
    });
    expect(String(thrown)).not.toContain("appservice-super-secret");
    expect(String(thrown)).not.toContain("matrix-device-secret");
  });
});
