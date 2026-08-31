import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();

describe("AgentOS 0.2.15 compatibility patches", () => {
  it("forwards public streaming stdin options and keeps the Apps guest RPC channel open", async () => {
    const [spawnTypes, agentOsRuntime, appsRuntime] = await Promise.all([
      installedSource(
        "@rivet-dev/agentos-core/dist/language-execution.d.ts",
      ),
      installedSource("@rivet-dev/agentos-core/dist/agent-os.js"),
      installedSource("@rivet-dev/agentos-apps/dist/index.js"),
    ]);

    expect(spawnTypes).toContain("streamStdin?: boolean;");
    expect(agentOsRuntime).toContain("streamStdin: options.streamStdin");

    const guestSpawnStart = appsRuntime.indexOf(
      'vm.process.spawn("node", ["/app/main.mjs"]',
    );
    expect(guestSpawnStart).toBeGreaterThanOrEqual(0);
    expect(appsRuntime.slice(guestSpawnStart, guestSpawnStart + 512)).toContain(
      "streamStdin: true",
    );
  });
});

async function installedSource(packagePath: string) {
  return readFile(resolve(repositoryRoot, "node_modules", packagePath), "utf8");
}
