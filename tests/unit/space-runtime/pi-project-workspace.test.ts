import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  loadSeed,
  readHostFiles,
  syncHostProjectFiles,
} from "../../../apps/space-runtime/src/adapters/pi/project-workspace";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("Pi project workspace", () => {
  it("loads the repository seed from the extracted module", async () => {
    await expect(loadSeed()).resolves.toMatchObject({
      "package.json": expect.any(String),
      "tsconfig.json": expect.any(String),
      "src/index.ts": expect.any(String),
    });
  });

  it("synchronizes the complete Host project tree and removes stale files", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "vibechat-pi-workspace-"));
    temporaryDirectories.push(workspace);
    const required = {
      "package.json": "{}",
      "tsconfig.json": "{}",
      "src/index.ts": "export default {}",
    };
    await syncHostProjectFiles(workspace, {
      ...required,
      "src/stale.ts": "export const stale = true",
    });
    await syncHostProjectFiles(workspace, {
      ...required,
      "src/current.ts": "export const current = true",
    });

    await expect(readHostFiles(workspace)).resolves.toEqual({
      ...required,
      "src/current.ts": "export const current = true",
    });
  });
});
