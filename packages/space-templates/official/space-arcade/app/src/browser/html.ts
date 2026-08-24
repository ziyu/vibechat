export function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>\"]/g, (character) => {
    if (character === "&") return "&amp;";
    if (character === "<") return "&lt;";
    if (character === ">") return "&gt;";
    return "&quot;";
  });
}
