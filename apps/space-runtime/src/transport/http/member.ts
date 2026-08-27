import type { SpaceMember } from "../../space-instance-server.js";

export function parseMember(clientId: unknown, name: unknown): SpaceMember {
  const normalizedClientId =
    typeof clientId === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(clientId)
      ? clientId
      : `guest-${Math.random().toString(36).slice(2, 10)}`;
  const normalizedName =
    typeof name === "string"
      ? name.trim().replace(/[\r\n\t]+/g, " ").slice(0, 24)
      : "";
  return {
    clientId: normalizedClientId,
    name: normalizedName || `访客 ${normalizedClientId.slice(-4)}`,
  };
}
