export const spaceRuntimeAudience = "space-runtime" as const;
export const spaceBackendCallbackAudience = "space-backend-callback" as const;
export const spaceAppPackageRegistryAudience =
  "space-app-package-registry" as const;

export type SpaceRuntimeCredentialAudience =
  | typeof spaceRuntimeAudience
  | typeof spaceBackendCallbackAudience
  | typeof spaceAppPackageRegistryAudience;

export interface SpaceRuntimeCredentialClaims {
  version: 1;
  audience: SpaceRuntimeCredentialAudience;
  subject: string;
  method: string;
  path: string;
  issuedAt: number;
  expiresAt: number;
  credentialId: string;
}

export interface SignSpaceRuntimeCredentialInput {
  secret: string;
  audience: SpaceRuntimeCredentialAudience;
  subject: string;
  method: string;
  path: string;
  ttlSeconds?: number;
  now?: Date;
  credentialId?: string;
}

export interface VerifySpaceRuntimeCredentialInput {
  secret: string;
  audience: SpaceRuntimeCredentialAudience;
  method: string;
  path: string;
  subject?: string;
  now?: Date;
  clockSkewSeconds?: number;
}

const credentialHeader = { alg: "HS256", typ: "VIBE-RUNTIME", version: 1 } as const;
const maximumCredentialLifetimeSeconds = 5 * 60;

export async function signSpaceRuntimeCredential(
  input: SignSpaceRuntimeCredentialInput,
) {
  assertSecret(input.secret);
  const issuedAt = epochSeconds(input.now);
  const ttlSeconds = input.ttlSeconds ?? 60;
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > maximumCredentialLifetimeSeconds) {
    throw new Error(`runtime credential ttl must be between 1 and ${maximumCredentialLifetimeSeconds} seconds`);
  }
  const claims: SpaceRuntimeCredentialClaims = {
    version: 1,
    audience: input.audience,
    subject: requiredString(input.subject, "subject"),
    method: normalizeMethod(input.method),
    path: normalizePath(input.path),
    issuedAt,
    expiresAt: issuedAt + ttlSeconds,
    credentialId: input.credentialId || globalThis.crypto.randomUUID(),
  };
  const encodedHeader = encodeJson(credentialHeader);
  const encodedClaims = encodeJson(claims);
  const content = `${encodedHeader}.${encodedClaims}`;
  const signature = await sign(input.secret, content);
  return `${content}.${encodeBytes(signature)}`;
}

export async function verifySpaceRuntimeCredential(
  credential: string,
  input: VerifySpaceRuntimeCredentialInput,
): Promise<SpaceRuntimeCredentialClaims | null> {
  try {
    assertSecret(input.secret);
    const parts = credential.split(".");
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedClaims, encodedSignature] = parts;
    if (!encodedHeader || !encodedClaims || !encodedSignature) return null;
    const header = decodeJson(encodedHeader);
    if (
      !isRecord(header)
      || header.alg !== credentialHeader.alg
      || header.typ !== credentialHeader.typ
      || header.version !== credentialHeader.version
    ) return null;
    const verified = await verify(
      input.secret,
      `${encodedHeader}.${encodedClaims}`,
      decodeBytes(encodedSignature),
    );
    if (!verified) return null;
    const claims = readClaims(decodeJson(encodedClaims));
    if (!claims) return null;

    const now = epochSeconds(input.now);
    const clockSkew = input.clockSkewSeconds ?? 5;
    if (claims.expiresAt <= now - clockSkew || claims.issuedAt > now + clockSkew) return null;
    if (claims.expiresAt - claims.issuedAt > maximumCredentialLifetimeSeconds) return null;
    if (claims.audience !== input.audience) return null;
    if (claims.method !== normalizeMethod(input.method)) return null;
    if (claims.path !== normalizePath(input.path)) return null;
    if (input.subject !== undefined && claims.subject !== input.subject) return null;
    return claims;
  } catch {
    return null;
  }
}

function readClaims(value: unknown): SpaceRuntimeCredentialClaims | null {
  if (!isRecord(value)) return null;
  if (
    value.version !== 1
    || (
      value.audience !== spaceRuntimeAudience
      && value.audience !== spaceBackendCallbackAudience
      && value.audience !== spaceAppPackageRegistryAudience
    )
    || typeof value.subject !== "string"
    || !value.subject
    || typeof value.method !== "string"
    || typeof value.path !== "string"
    || !Number.isInteger(value.issuedAt)
    || !Number.isInteger(value.expiresAt)
    || typeof value.credentialId !== "string"
    || !value.credentialId
  ) return null;
  return value as unknown as SpaceRuntimeCredentialClaims;
}

function epochSeconds(now: Date = new Date()) {
  return Math.floor(now.getTime() / 1_000);
}

function normalizeMethod(method: string) {
  return requiredString(method, "method").toUpperCase();
}

function normalizePath(path: string) {
  const normalized = requiredString(path, "path");
  if (!normalized.startsWith("/") || normalized.includes("#")) {
    throw new Error("runtime credential path must be an absolute URL path");
  }
  return normalized;
}

function requiredString(value: string, name: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`runtime credential ${name} is required`);
  return normalized;
}

function assertSecret(secret: string) {
  if (secret.trim().length < 16) {
    throw new Error("runtime credential signing secret must contain at least 16 characters");
  }
}

async function sign(secret: string, content: string) {
  const key = await importKey(secret);
  const signature = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(content),
  );
  return new Uint8Array(signature);
}

async function verify(secret: string, content: string, signature: Uint8Array) {
  const key = await importKey(secret);
  return globalThis.crypto.subtle.verify(
    "HMAC",
    key,
    Uint8Array.from(signature).buffer,
    new TextEncoder().encode(content),
  );
}

function importKey(secret: string) {
  return globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function encodeJson(value: unknown) {
  return encodeBytes(new TextEncoder().encode(JSON.stringify(value)));
}

function decodeJson(value: string) {
  return JSON.parse(new TextDecoder().decode(decodeBytes(value))) as unknown;
}

function encodeBytes(value: Uint8Array) {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return globalThis.btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeBytes(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("invalid base64url");
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const binary = globalThis.atob(value.replaceAll("-", "+").replaceAll("_", "/") + padding);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
