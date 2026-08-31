const hopByHopHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const appRequestHeaderAllowlist = new Set([
  "accept",
  "accept-language",
  "content-type",
  "if-modified-since",
  "if-none-match",
  "range",
]);

export function requestHeaders(input: Headers) {
  const output: Record<string, string> = {};
  input.forEach((value, name) => {
    const normalizedName = name.toLowerCase();
    if (!appRequestHeaderAllowlist.has(normalizedName)) return;
    output[normalizedName] = value;
  });
  return output;
}

export function responseHeaders(
  rawHeaders: Array<[string, string]> | undefined,
  headers: Record<string, string>,
) {
  const output = new Headers();
  for (const [name, value] of rawHeaders ?? Object.entries(headers)) {
    if (hopByHopHeaders.has(name.toLowerCase())) continue;
    output.append(name, value);
  }
  return output;
}
