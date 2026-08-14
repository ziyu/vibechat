import { describe, expect, it } from "vitest";
import { AesGcmMatrixTokenProtector } from "@libs/identity/token-protector";

function toBase64Url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64url");
}

describe("AesGcmMatrixTokenProtector", () => {
  it("round-trips a token without embedding plaintext in persisted ciphertext", async () => {
    const protector = new AesGcmMatrixTokenProtector(
      toBase64Url(Uint8Array.from({ length: 32 }, (_, index) => index)),
    );
    const token = "syt_private_matrix_access_token";

    const ciphertext = await protector.protect(token);

    expect(ciphertext).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(ciphertext).not.toContain(token);
    await expect(protector.unprotect(ciphertext)).resolves.toBe(token);
  });

  it("rejects keys that are not 256 bits", () => {
    expect(() => new AesGcmMatrixTokenProtector(toBase64Url(new Uint8Array(16))))
      .toThrow("exactly 32 bytes");
  });
});
