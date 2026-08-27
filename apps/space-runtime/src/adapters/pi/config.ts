import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type PiMode = "agentos" | "host";

const providerCredentialNames = [
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_OAUTH_TOKEN",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "OPENROUTER_API_KEY",
  "ZAI_API_KEY",
  "GROQ_API_KEY",
  "CEREBRAS_API_KEY",
  "XAI_API_KEY",
  "MISTRAL_API_KEY",
  "AI_GATEWAY_API_KEY",
] as const;

export function hasModelCredentials() {
  return (
    piMode() === "host" ||
    providerCredentialNames.some((name) => Boolean(process.env[name]))
  );
}

export function configuredProvider() {
  if (piMode() === "host") return localPiProvider();
  const name = providerCredentialNames.find((candidate) =>
    Boolean(process.env[candidate]),
  );
  if (!name) return localPiProvider();
  if (name.startsWith("ANTHROPIC_")) return "anthropic";
  if (name === "OPENAI_API_KEY") return "openai";
  if (name === "GEMINI_API_KEY") return "google";
  if (name === "AI_GATEWAY_API_KEY") return "vercel-ai-gateway";
  return name.toLowerCase().replace(/_api_key$/, "").replaceAll("_", "-");
}

function localPiProvider() {
  try {
    const settings = JSON.parse(
      readFileSync(join(homedir(), ".pi", "agent", "settings.json"), "utf8"),
    ) as { defaultProvider?: unknown };
    return typeof settings.defaultProvider === "string"
      ? settings.defaultProvider
      : "local-config";
  } catch {
    return piMode() === "host" ? "local-config" : null;
  }
}

export function piMode(): PiMode {
  if (process.env.PI_MODE === "agentos" || process.env.PI_MODE === "host") {
    return process.env.PI_MODE;
  }
  return existsSync(join(homedir(), ".pi", "agent", "auth.json"))
    ? "host"
    : "agentos";
}
