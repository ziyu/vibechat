export function escapeSpaceAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function sanitizeSpaceMediaUrl(value?: string | null) {
  const source = value?.trim();
  if (!source) return null;
  if (source.startsWith("/") && !source.startsWith("//")) return source;
  try {
    const url = new URL(source);
    return ["https:", "http:", "blob:"].includes(url.protocol)
      ? url.href
      : null;
  } catch {
    return null;
  }
}
