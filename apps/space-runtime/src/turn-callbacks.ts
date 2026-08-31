import {
  spaceAgentBillingCallbackSchema,
  spaceAgentCompletionCallbackSchema,
} from "@vibechat/space-agent-contracts";
import {
  signSpaceRuntimeCredential,
  spaceBackendCallbackAudience,
} from "@vibechat/space-runtime-auth";
import {
  splitAgentUsage,
  type AgentUsage,
  versionAgentUsage,
} from "./agent-usage.js";
import type {
  ClaimedSpaceTurn,
  SpaceTurnBilling,
} from "./space-instance-server.js";

export interface SpaceTurnReply {
  agentId: string;
  agentName: string;
  text: string;
}

export function parseBilling(value: unknown): SpaceTurnBilling | null {
  if (!value || typeof value !== "object") return null;
  const billing = value as Record<string, unknown>;
  if (
    typeof billing.callbackUrl !== "string" ||
    typeof billing.spaceInstanceId !== "string" ||
    !billing.spaceInstanceId ||
    typeof billing.userId !== "string" ||
    typeof billing.requestId !== "string" ||
    typeof billing.provider !== "string" ||
    typeof billing.model !== "string" ||
    typeof billing.reservedCredits !== "number" ||
    !Number.isSafeInteger(billing.reservedCredits) ||
    billing.reservedCredits <= 0 ||
    typeof billing.transactionId !== "string"
  ) return null;
  const callbackUrl = parseHttpUrl(billing.callbackUrl);
  if (!callbackUrl) return null;
  const completion = parseCompletionDelivery(billing.completion);
  if (billing.completion && !completion) return null;
  return {
    callbackUrl,
    spaceInstanceId: billing.spaceInstanceId,
    ...(completion ? { completion } : {}),
    userId: billing.userId,
    requestId: billing.requestId,
    provider: billing.provider,
    model: billing.model,
    reservedCredits: billing.reservedCredits,
    transactionId: billing.transactionId,
  };
}

export async function reportTurnBilling(input: {
  turn: ClaimedSpaceTurn;
  status: "completed" | "failed";
  signingSecret: string;
  usage?: AgentUsage;
  fetch?: typeof globalThis.fetch;
}) {
  if (!input.signingSecret) return;
  const fetchImpl = input.fetch || globalThis.fetch;
  const billableRequests = input.turn.requests.filter((request) => request.billing);
  const allocatedUsage = splitAgentUsage(input.usage, billableRequests.length);
  await Promise.all(billableRequests.map(async (request, index) => {
    const billing = request.billing!;
    const authorization = await createCallbackAuthorization(
      billing.callbackUrl,
      input.signingSecret,
    );
    const payload = spaceAgentBillingCallbackSchema.parse({
      schemaVersion: "vibechat.space-agent-billing/v1",
      spaceInstanceId: billing.spaceInstanceId,
      turnId: input.turn.turnId,
      userId: billing.userId,
      requestId: billing.requestId,
      provider: billing.provider,
      model: billing.model,
      reservedCredits: billing.reservedCredits,
      transactionId: billing.transactionId,
      status: input.status,
      ...(input.status === "completed"
        ? { usage: versionAgentUsage(allocatedUsage[index] ?? {}) }
        : {}),
    });
    const response = await fetchImpl(billing.callbackUrl, {
      method: "POST",
      headers: {
        authorization,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`billing callback returned ${response.status}`);
  }));
}

export async function reportTurnCompletion(input: {
  turn: ClaimedSpaceTurn;
  reply: SpaceTurnReply;
  signingSecret: string;
  fetch?: typeof globalThis.fetch;
}) {
  if (!input.signingSecret) return;
  const request = input.turn.requests.find((candidate) => candidate.billing?.completion);
  const billing = request?.billing;
  const completion = billing?.completion;
  if (!billing || !completion) return;
  const payload = spaceAgentCompletionCallbackSchema.parse({
    schemaVersion: "vibechat.space-agent-completion/v1",
    userId: billing.userId,
    spaceInstanceId: completion.spaceInstanceId,
    matrixRoomId: completion.matrixRoomId,
    turnId: input.turn.turnId,
    agentId: input.reply.agentId,
    agentName: input.reply.agentName,
    sourceEventIds: input.turn.requests.map((candidate) => candidate.externalRequestId),
    reply: { text: input.reply.text },
  });
  await postCompletionWithRetry({
    callbackUrl: completion.callbackUrl,
    payload,
    signingSecret: input.signingSecret,
    fetch: input.fetch || globalThis.fetch,
  });
}

function parseCompletionDelivery(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const completion = value as Record<string, unknown>;
  if (
    typeof completion.callbackUrl !== "string" ||
    typeof completion.spaceInstanceId !== "string" ||
    !completion.spaceInstanceId ||
    typeof completion.matrixRoomId !== "string" ||
    !completion.matrixRoomId ||
    typeof completion.matrixEventId !== "string" ||
    !completion.matrixEventId
  ) return null;
  const callbackUrl = parseHttpUrl(completion.callbackUrl);
  if (!callbackUrl) return null;
  return {
    callbackUrl,
    spaceInstanceId: completion.spaceInstanceId,
    matrixRoomId: completion.matrixRoomId,
    matrixEventId: completion.matrixEventId,
  };
}

function parseHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

async function postCompletionWithRetry(input: {
  callbackUrl: string;
  payload: ReturnType<typeof spaceAgentCompletionCallbackSchema.parse>;
  signingSecret: string;
  fetch: typeof globalThis.fetch;
}) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const authorization = await createCallbackAuthorization(
        input.callbackUrl,
        input.signingSecret,
      );
      const response = await input.fetch(input.callbackUrl, {
        method: "POST",
        headers: {
          authorization,
          "content-type": "application/json",
        },
        body: JSON.stringify(input.payload),
      });
      if (response.ok) return;
      const error = new Error(`completion callback returned ${response.status}`);
      if (response.status < 500 && response.status !== 429) throw error;
      lastError = error;
    } catch (error) {
      lastError = error;
    }
    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("completion callback failed");
}

async function createCallbackAuthorization(callbackUrl: string, signingSecret: string) {
  const path = new URL(callbackUrl).pathname;
  const credential = await signSpaceRuntimeCredential({
    secret: signingSecret,
    audience: spaceBackendCallbackAudience,
    subject: "space-runtime",
    method: "POST",
    path,
    ttlSeconds: 60,
  });
  return `Bearer ${credential}`;
}
