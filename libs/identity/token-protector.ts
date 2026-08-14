import type { MatrixTokenProtector } from "./contracts";

const VERSION = "v1";

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export class AesGcmMatrixTokenProtector implements MatrixTokenProtector {
  private readonly keyPromise: Promise<CryptoKey>;

  constructor(base64UrlKey: string) {
    const keyBytes = fromBase64Url(base64UrlKey);
    if (keyBytes.byteLength !== 32) {
      throw new Error("Matrix token encryption key must contain exactly 32 bytes");
    }

    this.keyPromise = globalThis.crypto.subtle.importKey(
      "raw",
      keyBytes,
      "AES-GCM",
      false,
      ["encrypt", "decrypt"],
    );
  }

  async protect(accessToken: string) {
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(accessToken);
    const ciphertext = await globalThis.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await this.keyPromise,
      plaintext,
    );

    return `${VERSION}.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(ciphertext))}`;
  }

  async unprotect(value: string) {
    const [version, ivValue, ciphertextValue, ...rest] = value.split(".");
    if (version !== VERSION || !ivValue || !ciphertextValue || rest.length > 0) {
      throw new Error("Unsupported Matrix token ciphertext format");
    }

    const plaintext = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64Url(ivValue) },
      await this.keyPromise,
      fromBase64Url(ciphertextValue),
    );

    return new TextDecoder().decode(plaintext);
  }
}

export class UnavailableMatrixTokenProtector implements MatrixTokenProtector {
  async protect(): Promise<never> {
    throw new Error("Matrix token protection is not configured");
  }

  async unprotect(): Promise<never> {
    throw new Error("Matrix token protection is not configured");
  }
}
