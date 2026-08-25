export interface RivetEngineHealth {
  ok: boolean;
  status: number | null;
  runtime?: string;
  version?: string;
}

export async function checkRivetEngineHealth(
  endpoint: string,
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
  timeoutMs = 1_000,
): Promise<RivetEngineHealth> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(new URL("/health", endpoint), {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null) as Record<string, unknown> | null;
    const healthy = response.ok && body?.status === "ok";
    return {
      ok: healthy,
      status: response.status,
      ...(typeof body?.runtime === "string" ? { runtime: body.runtime } : {}),
      ...(typeof body?.version === "string" ? { version: body.version } : {}),
    };
  } catch {
    return { ok: false, status: null };
  } finally {
    clearTimeout(timeout);
  }
}
