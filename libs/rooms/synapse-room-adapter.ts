import type { MatrixRoomAdapter } from "./contracts";
import type { CreateMatrixRoomInput } from "./types";

export class MatrixRoomAdapterError extends Error {
  readonly status: number | null;
  readonly matrixErrorCode: string | null;

  constructor(options: { status?: number; matrixErrorCode?: string } = {}) {
    super("MATRIX_ROOM_CREATE_FAILED");
    this.name = "MatrixRoomAdapterError";
    this.status = options.status ?? null;
    this.matrixErrorCode = options.matrixErrorCode ?? null;
  }
}

export class SynapseMatrixRoomAdapter implements MatrixRoomAdapter {
  private readonly homeserverUrl: string;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(options: { homeserverUrl: string; fetch?: typeof globalThis.fetch }) {
    this.homeserverUrl = options.homeserverUrl.replace(/\/$/, "");
    this.fetchImpl = options.fetch || globalThis.fetch;
  }

  async createRoom(input: CreateMatrixRoomInput) {
    let response: Response;
    try {
      response = await this.fetchImpl(
        `${this.homeserverUrl}/_matrix/client/v3/createRoom`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${input.accessToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            preset: "private_chat",
            name: input.name,
            invite: input.inviteMatrixUserIds,
            is_direct: input.inviteMatrixUserIds.length === 1,
            initial_state: [
              {
                type: "io.vibechat.space.instance.v1",
                state_key: "",
                content: {
                  startMode: input.space ? "template" : "blank",
                  spaceInstanceId: input.spaceInstanceId,
                  projectId: input.projectId,
                  defaultAgentId: input.defaultAgentId,
                  ...(input.space ? {
                    spaceId: input.space.id,
                    spaceVersionId: input.space.versionId,
                    templateId: input.space.id,
                    templateVersionId: input.space.versionId,
                    version: input.space.semanticVersion,
                    integrity: input.space.integrity,
                    publisher: input.space.publisher,
                    permissions: input.space.permissions,
                    networkDomains: input.space.networkDomains,
                  } : {}),
                  instanceConfig: input.instanceConfig,
                  createdBy: input.creatorMatrixUserId,
                },
              },
            ],
          }),
        },
      );
    } catch {
      throw new MatrixRoomAdapterError();
    }

    let body: Record<string, unknown> | null = null;
    try {
      body = await response.json() as Record<string, unknown>;
    } catch {
      // Stable adapter error below deliberately excludes the response body.
    }
    if (!response.ok || typeof body?.room_id !== "string") {
      throw new MatrixRoomAdapterError({
        status: response.status,
        matrixErrorCode: typeof body?.errcode === "string" ? body.errcode : undefined,
      });
    }

    return { matrixRoomId: body.room_id };
  }
}
