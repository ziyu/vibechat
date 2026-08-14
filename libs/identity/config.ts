export type MatrixRuntimeConfig =
  | {
      status: "unavailable";
      reason: "SYNAPSE_NOT_CONFIGURED";
    }
  | {
      status: "ready";
      homeserverUrl: string;
      publicHomeserverUrl: string;
      serverName: string;
      appserviceToken: string;
      tokenEncryptionKey: string;
      userPrefix: string;
    };

const requiredKeys = [
  "MATRIX_HOMESERVER_URL",
  "MATRIX_SERVER_NAME",
  "MATRIX_APPSERVICE_TOKEN",
  "MATRIX_TOKEN_ENCRYPTION_KEY",
] as const;

function normalizeUrl(value: string, key: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${key} must be a valid HTTP(S) URL`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${key} must be a valid HTTP(S) URL`);
  }

  return url.toString().replace(/\/$/, "");
}

export function readMatrixRuntimeConfig(
  env: Record<string, string | undefined> = process.env,
): MatrixRuntimeConfig {
  const configuredKeys = requiredKeys.filter((key) => Boolean(env[key]?.trim()));
  if (configuredKeys.length === 0) {
    return {
      status: "unavailable",
      reason: "SYNAPSE_NOT_CONFIGURED",
    };
  }

  const missingKeys = requiredKeys.filter((key) => !env[key]?.trim());
  if (missingKeys.length > 0) {
    throw new Error(`Matrix configuration is incomplete; missing ${missingKeys.join(", ")}`);
  }

  const serverName = env.MATRIX_SERVER_NAME!.trim();
  if (/[@/\s]/.test(serverName)) {
    throw new Error("MATRIX_SERVER_NAME is invalid");
  }

  const userPrefix = env.MATRIX_USER_PREFIX?.trim() || "vibe_";
  if (!/^[a-z0-9._=-]+$/.test(userPrefix)) {
    throw new Error("MATRIX_USER_PREFIX must contain only Matrix localpart characters");
  }

  const homeserverUrl = normalizeUrl(
    env.MATRIX_HOMESERVER_URL!,
    "MATRIX_HOMESERVER_URL",
  );
  const publicHomeserverUrl = normalizeUrl(
    env.MATRIX_PUBLIC_HOMESERVER_URL?.trim() || homeserverUrl,
    "MATRIX_PUBLIC_HOMESERVER_URL",
  );

  return {
    status: "ready",
    homeserverUrl,
    publicHomeserverUrl,
    serverName,
    appserviceToken: env.MATRIX_APPSERVICE_TOKEN!.trim(),
    tokenEncryptionKey: env.MATRIX_TOKEN_ENCRYPTION_KEY!.trim(),
    userPrefix,
  };
}
