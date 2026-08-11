const MAX_BASE_LENGTH = 20;
const MAX_SUFFIX_LENGTH = 10;

function normalizeSegment(value: string, fallback: string) {
  const normalized = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || fallback;
}

export function deriveUsername(email: string, userId: string) {
  const emailLocalPart = email.split("@", 1)[0] || "user";
  const base = normalizeSegment(emailLocalPart, "user").slice(0, MAX_BASE_LENGTH);
  const suffix = normalizeSegment(userId, "account").slice(-MAX_SUFFIX_LENGTH);

  return `${base}_${suffix}`;
}

export function deriveDisplayName(
  displayName: string | null,
  email: string,
  username: string,
) {
  const trimmed = displayName?.trim();
  if (trimmed) return trimmed;

  return email.split("@", 1)[0]?.trim() || username;
}
