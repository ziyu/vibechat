export interface RuntimeObjectStore {
  put(content: Uint8Array, contentType: string): Promise<{ objectKey: string; hash: `sha256:${string}` }>;
  get(objectKey: string): Promise<Uint8Array | null>;
}

export interface RuntimeR2Bucket {
  put(key: string, value: ArrayBuffer | ArrayBufferView, options?: {
    httpMetadata?: { contentType?: string };
    customMetadata?: Record<string, string>;
  }): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
}

export class R2RuntimeObjectStore implements RuntimeObjectStore {
  constructor(private readonly bucket: RuntimeR2Bucket) {}

  async put(content: Uint8Array, contentType: string) {
    const hash = await sha256(content);
    const objectKey = `space-runtime/objects/${hash.slice("sha256:".length)}`;
    await this.bucket.put(objectKey, content, {
      httpMetadata: { contentType },
      customMetadata: { sha256: hash },
    });
    return { objectKey, hash };
  }

  async get(objectKey: string) {
    const object = await this.bucket.get(objectKey);
    return object ? new Uint8Array(await object.arrayBuffer()) : null;
  }
}

async function sha256(content: Uint8Array): Promise<`sha256:${string}`> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    Uint8Array.from(content).buffer,
  );
  return `sha256:${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}
