import type { SynapseAdapter } from "./contracts";

export type SynapseAdapterErrorCode =
  | "SYNAPSE_HTTP_ERROR"
  | "SYNAPSE_INVALID_RESPONSE"
  | "SYNAPSE_UNREACHABLE"
  | "SYNAPSE_USER_MISMATCH"
  | "SYNAPSE_DEVICE_MISMATCH";

export class SynapseAdapterError extends Error {
  readonly code: SynapseAdapterErrorCode;
  readonly status: number | null;
  readonly matrixErrorCode: string | null;

  constructor(
    code: SynapseAdapterErrorCode,
    options: { status?: number; matrixErrorCode?: string } = {},
  ) {
    super(code);
    this.name = "SynapseAdapterError";
    this.code = code;
    this.status = options.status ?? null;
    this.matrixErrorCode = options.matrixErrorCode ?? null;
  }
}

export interface SynapseAppserviceAdapterOptions {
  homeserverUrl: string;
  publicHomeserverUrl?: string;
  serverName: string;
  appserviceToken: string;
  userPrefix?: string;
  fetch?: typeof globalThis.fetch;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJson(response: Response) {
  try {
    const value: unknown = await response.json();
    return isObject(value) ? value : null;
  } catch {
    return null;
  }
}

function matrixErrorCode(value: Record<string, unknown> | null) {
  return typeof value?.errcode === "string" ? value.errcode : null;
}

export class SynapseAppserviceAdapter implements SynapseAdapter {
  private readonly homeserverUrl: string;
  private readonly publicHomeserverUrl: string;
  private readonly serverName: string;
  private readonly appserviceToken: string;
  private readonly userPrefix: string;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(options: SynapseAppserviceAdapterOptions) {
    this.homeserverUrl = options.homeserverUrl.replace(/\/$/, "");
    this.publicHomeserverUrl = (
      options.publicHomeserverUrl || options.homeserverUrl
    ).replace(/\/$/, "");
    this.serverName = options.serverName;
    this.appserviceToken = options.appserviceToken;
    this.userPrefix = options.userPrefix || "vibe_";
    this.fetchImpl = options.fetch || globalThis.fetch;
  }

  availability() {
    return {
      available: true as const,
      homeserverUrl: this.publicHomeserverUrl,
    };
  }

  async ensureUser(input: {
    externalUserId: string;
    localpart: string;
    displayName: string;
  }) {
    const localpart = this.managedLocalpart(input.localpart);
    const expectedUserId = `@${localpart}:${this.serverName}`;
    const response = await this.request(
      "/_matrix/client/v3/register",
      this.appserviceToken,
      {
        type: "m.login.application_service",
        username: localpart,
        inhibit_login: true,
      },
    );
    const body = await readJson(response);

    if (!response.ok) {
      const errcode = matrixErrorCode(body);
      if (response.status !== 400 || errcode !== "M_USER_IN_USE") {
        throw new SynapseAdapterError("SYNAPSE_HTTP_ERROR", {
          status: response.status,
          matrixErrorCode: errcode || undefined,
        });
      }
    } else if (body?.user_id !== expectedUserId) {
      throw new SynapseAdapterError("SYNAPSE_USER_MISMATCH");
    }

    await this.updateDisplayName(expectedUserId, input.displayName);
    return { matrixUserId: expectedUserId };
  }

  async createSessionDevice(input: {
    matrixUserId: string;
    authSessionId: string;
    displayName: string;
  }) {
    const deviceId = this.createDeviceId();
    const response = await this.request(
      "/_matrix/client/v3/login",
      this.appserviceToken,
      {
        type: "m.login.application_service",
        identifier: {
          type: "m.id.user",
          user: input.matrixUserId,
        },
        device_id: deviceId,
        initial_device_display_name: input.displayName,
      },
    );
    const body = await readJson(response);

    if (!response.ok) {
      throw new SynapseAdapterError("SYNAPSE_HTTP_ERROR", {
        status: response.status,
        matrixErrorCode: matrixErrorCode(body) || undefined,
      });
    }
    if (
      typeof body?.access_token !== "string"
      || typeof body.device_id !== "string"
      || typeof body.user_id !== "string"
    ) {
      throw new SynapseAdapterError("SYNAPSE_INVALID_RESPONSE");
    }
    if (body.user_id !== input.matrixUserId) {
      throw new SynapseAdapterError("SYNAPSE_USER_MISMATCH");
    }
    if (body.device_id !== deviceId) {
      throw new SynapseAdapterError("SYNAPSE_DEVICE_MISMATCH");
    }

    return {
      deviceId: body.device_id,
      accessToken: body.access_token,
    };
  }

  async revokeDevice(input: {
    matrixUserId: string;
    deviceId: string;
    accessToken: string;
  }) {
    const response = await this.request(
      "/_matrix/client/v3/logout",
      input.accessToken,
      {},
    );
    if (response.ok) return;

    const body = await readJson(response);
    const errcode = matrixErrorCode(body);
    if (response.status === 401 && errcode === "M_UNKNOWN_TOKEN") return;

    throw new SynapseAdapterError("SYNAPSE_HTTP_ERROR", {
      status: response.status,
      matrixErrorCode: errcode || undefined,
    });
  }

  private managedLocalpart(value: string) {
    if (!/^[a-z0-9._=-]+$/.test(value)) {
      throw new SynapseAdapterError("SYNAPSE_INVALID_RESPONSE");
    }
    return `${this.userPrefix}${value}`;
  }

  private createDeviceId() {
    return `VIBE_${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 24).toUpperCase()}`;
  }

  private async updateDisplayName(matrixUserId: string, displayName: string) {
    const path = `/_matrix/client/v3/profile/${encodeURIComponent(matrixUserId)}/displayname`;
    const url = new URL(`${this.homeserverUrl}${path}`);
    url.searchParams.set("user_id", matrixUserId);
    const response = await this.requestUrl(
      url,
      this.appserviceToken,
      { displayname: displayName },
      "PUT",
    );

    if (!response.ok) {
      const body = await readJson(response);
      throw new SynapseAdapterError("SYNAPSE_HTTP_ERROR", {
        status: response.status,
        matrixErrorCode: matrixErrorCode(body) || undefined,
      });
    }
  }

  private request(path: string, token: string, body: Record<string, unknown>) {
    return this.requestUrl(new URL(`${this.homeserverUrl}${path}`), token, body);
  }

  private async requestUrl(
    url: URL,
    token: string,
    body: Record<string, unknown>,
    method: "POST" | "PUT" = "POST",
  ) {
    try {
      return await this.fetchImpl(url, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new SynapseAdapterError("SYNAPSE_UNREACHABLE");
    }
  }
}
