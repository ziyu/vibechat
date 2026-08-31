import { describe, expect, it } from "vitest";
import { requestHeaders } from "../../../apps/space-runtime/src/transport/http/headers";

describe("Space App proxy request headers", () => {
  it("forwards only App-safe representation headers", () => {
    const input = new Headers({
      accept: "text/html",
      "accept-language": "zh-CN",
      authorization: "Bearer runtime-internal-credential",
      cookie: "better-auth.session=private",
      forwarded: "for=127.0.0.1",
      "if-none-match": '"revision-1"',
      "proxy-authorization": "Basic private",
      "x-forwarded-for": "127.0.0.1",
      "x-vibechat-internal-token": "private",
    });

    expect(requestHeaders(input)).toEqual({
      accept: "text/html",
      "accept-language": "zh-CN",
      "if-none-match": '"revision-1"',
    });
  });
});
