import { createHash } from "node:crypto";
import { createClient } from "@rivet-dev/agentos/client";
import ts from "typescript";
import type { registry } from "./actors.js";
import {
  assertAppId,
  editablePaths,
  type ProjectFiles,
} from "./project-store.js";

const workspace = "/workspace";
const devPort = 4173;
const runnerPath = `${workspace}/space-dev-runner.mjs`;
const applicationPath = `${workspace}/space-dev-application.mjs`;
const rivetKitShimPath = `${workspace}/space-dev-rivetkit.mjs`;
const maximumProxyBodyBytes = 4 * 1024 * 1024;
const decoder = new TextDecoder();
const devSessionId = `${process.pid}-${Date.now().toString(36)}`;

const client = createClient<typeof registry>({
  endpoint: process.env.AGENTOS_ENDPOINT ?? "http://127.0.0.1:6420",
});

export type DevPreviewStatus =
  | { state: "idle" }
  | { state: "building"; version: string }
  | { state: "ready"; version: string; updatedAt: string }
  | { state: "failed"; version: string; error: string };

export interface DevPreviewResult {
  version: string;
  updatedAt: string;
  url: string;
}

export class DevPreviewError extends Error {
  readonly code = "space_dev_preview_failed";
  readonly diagnostics: string;

  constructor(message: string, diagnostics = message) {
    super(message);
    this.name = "DevPreviewError";
    this.diagnostics = diagnostics.slice(0, 16 * 1024);
  }
}

type StatusReporter = (message: string) => void | Promise<void>;

export class DevPreviewManager {
  readonly #statuses = new Map<string, DevPreviewStatus>();
  readonly #pids = new Map<string, number>();
  readonly #active = new Map<
    string,
    { version: string; promise: Promise<DevPreviewResult> }
  >();

  status(appId: string): DevPreviewStatus {
    assertAppId(appId);
    return this.#statuses.get(appId) ?? { state: "idle" };
  }

  prepare(
    appId: string,
    files: ProjectFiles,
    onStatus?: StatusReporter,
  ): Promise<DevPreviewResult> {
    assertAppId(appId);
    const version = draftVersion(files);
    const current = this.#statuses.get(appId);
    if (current?.state === "ready" && current.version === version) {
      return Promise.resolve({
        version,
        updatedAt: current.updatedAt,
        url: devPreviewUrl(appId, version),
      });
    }
    const active = this.#active.get(appId);
    if (active?.version === version) return active.promise;

    const previous = active?.promise.catch(() => undefined) ?? Promise.resolve();
    const promise = previous
      .then(() => this.#build(appId, files, version, onStatus))
      .finally(() => {
        if (this.#active.get(appId)?.promise === promise) {
          this.#active.delete(appId);
        }
      });
    this.#active.set(appId, { version, promise });
    return promise;
  }

  async fetch(
    appId: string,
    url: string,
    request: {
      method: string;
      headers: Record<string, string>;
      body?: Uint8Array;
    },
  ) {
    assertAppId(appId);
    if (request.body && request.body.byteLength > maximumProxyBodyBytes) {
      throw new DevPreviewError(
        `dev preview request exceeds ${maximumProxyBodyBytes} bytes`,
      );
    }
    const status = this.status(appId);
    if (status.state !== "ready") {
      throw new DevPreviewError("Space 开发预览尚未就绪");
    }
    return client.vm.getOrCreate(devActorKey(appId)).vmFetch(devPort, url, {
      method: request.method,
      headers: request.headers,
      ...(request.body ? { body: request.body } : {}),
    });
  }

  async #build(
    appId: string,
    files: ProjectFiles,
    version: string,
    onStatus?: StatusReporter,
  ): Promise<DevPreviewResult> {
    this.#statuses.set(appId, { state: "building", version });
    const agent = client.vm.getOrCreate(devActorKey(appId));

    try {
      await onStatus?.("正在同步到 Space Dev VM…");
      await agent.filesystem.mkdir(`${workspace}/src`, { recursive: true });
      await agent.filesystem.writeFiles(
        editablePaths.map((path) => ({
          path: `${workspace}/${path}`,
          content: files[path],
        })),
      );

      await onStatus?.("正在快速转译开发版本…");
      const compiled = compileDevApplication(files["src/index.ts"]);
      await agent.filesystem.writeFiles([
        { path: applicationPath, content: compiled.code },
        { path: rivetKitShimPath, content: rivetKitShim(compiled.imports) },
        { path: runnerPath, content: devRunnerSource() },
      ]);
      const previousPid = this.#pids.get(appId);
      if (
        previousPid !== undefined &&
        Number.isSafeInteger(previousPid) &&
        previousPid > 0
      ) {
        await agent.process.kill(previousPid).catch(() => undefined);
      }

      await onStatus?.("正在重载 Space 开发应用…");
      const process = await agent.javascript.spawnFile(runnerPath, {
        cwd: workspace,
        env: {
          SPACE_DEV_PORT: String(devPort),
          SPACE_DEV_VERSION: version,
        },
        output: { retainEvents: true },
      });
      this.#pids.set(appId, process.pid);
      await waitUntilReady(agent, process.pid, version);

      const updatedAt = new Date().toISOString();
      this.#statuses.set(appId, { state: "ready", version, updatedAt });
      return { version, updatedAt, url: devPreviewUrl(appId, version) };
    } catch (error) {
      const normalized = normalizeDevError(error);
      this.#statuses.set(appId, {
        state: "failed",
        version,
        error: normalized.message,
      });
      throw normalized;
    }
  }
}

export function draftVersion(files: ProjectFiles) {
  const hash = createHash("sha256");
  for (const path of editablePaths) {
    hash.update(path).update("\0").update(files[path]).update("\0");
  }
  return hash.digest("hex").slice(0, 16);
}

export function devPreviewUrl(appId: string, version: string) {
  return `/runtime/dev/apps/${encodeURIComponent(appId)}/?draft=${encodeURIComponent(version)}`;
}

function devActorKey(appId: string) {
  return `space-dev-${devSessionId}-${appId}`;
}

async function waitUntilReady(
  agent: ReturnType<typeof client.vm.getOrCreate>,
  pid: number,
  version: string,
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await agent.vmFetch(
        devPort,
        "http://space-dev.local/__space_dev_health",
      );
      if (
        response.status === 200 &&
        decoder.decode(response.body).trim() === version
      ) {
        return;
      }
      lastError = new Error(`health check returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  let output = "";
  try {
    const captured = await agent.process.readOutput(pid);
    output = captured.events
      .map((event) => Buffer.from(event.chunk.data, "base64").toString("utf8"))
      .join("");
  } catch {
    // The health error below is still actionable when process output expired.
  }
  throw new DevPreviewError(
    "Space Dev Server 启动失败",
    `${lastError instanceof Error ? lastError.message : String(lastError)}\n${output}`,
  );
}

function normalizeDevError(error: unknown) {
  if (error instanceof DevPreviewError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new DevPreviewError(message);
}

function compileDevApplication(source: string) {
  const sourceFile = ts.createSourceFile(
    "src/index.ts",
    source,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS,
  );
  const imports = new Set<string>();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const specifier = ts.isStringLiteral(statement.moduleSpecifier)
      ? statement.moduleSpecifier.text
      : "";
    if (specifier !== "rivetkit" && !specifier.startsWith("rivetkit/")) {
      continue;
    }
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const binding of bindings.elements) {
        imports.add(binding.propertyName?.text ?? binding.name.text);
      }
    }
  }

  const result = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      verbatimModuleSyntax: false,
    },
    fileName: "src/index.ts",
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  if (errors.length > 0) {
    const diagnostics = errors
      .map((diagnostic) => {
        const message = ts.flattenDiagnosticMessageText(
          diagnostic.messageText,
          "\n",
        );
        if (diagnostic.start === undefined) return message;
        const position = sourceFile.getLineAndCharacterOfPosition(diagnostic.start);
        return `src/index.ts:${position.line + 1}:${position.character + 1} ${message}`;
      })
      .join("\n");
    throw new DevPreviewError("开发版本存在 TypeScript 语法错误", diagnostics);
  }

  const code = result.outputText
    .replace(
      /(\bfrom\s*)(["'])rivetkit(?:\/[^"']*)?\2/g,
      (_match, prefix: string, quote: string) =>
        `${prefix}${quote}./space-dev-rivetkit.mjs${quote}`,
    )
    .replace(
      /(^\s*import\s*)(["'])rivetkit(?:\/[^"']*)?\2/gm,
      (_match, prefix: string, quote: string) =>
        `${prefix}${quote}./space-dev-rivetkit.mjs${quote}`,
    )
    .replace(
      /(\bimport\s*\(\s*)(["'])rivetkit(?:\/[^"']*)?\2/g,
      (_match, prefix: string, quote: string) =>
        `${prefix}${quote}./space-dev-rivetkit.mjs${quote}`,
    );
  return { code, imports };
}

function rivetKitShim(imports: Set<string>) {
  const known = new Set([
    "Registry",
    "actor",
    "createClient",
    "db",
    "event",
    "queue",
    "setup",
  ]);
  const fallbacks = [...imports]
    .filter((name) => !known.has(name) && /^[$A-Z_a-z][$\w]*$/.test(name))
    .map((name) => `export const ${name} = spaceDevPassthrough;`)
    .join("\n");
  return `const spaceDevPassthrough = (value) => value;
const spaceDevActionHandle = new Proxy({}, {
  get: () => async () => null,
});
const spaceDevActorClient = new Proxy({}, {
  get: () => () => spaceDevActionHandle,
});

export const actor = spaceDevPassthrough;
export const event = spaceDevPassthrough;
export const queue = spaceDevPassthrough;
export const db = spaceDevPassthrough;
export function setup(options = {}) {
  return {
    use: options.use || {},
    start() {},
    async handler() {
      return new Response("RivetKit actor routes become active after publishing", {
        status: 503,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    },
  };
}
export function createClient() {
  return new Proxy({}, { get: () => spaceDevActorClient });
}
export class Registry {
  start() {}
}
${fallbacks}
export default { actor, createClient, db, event, queue, setup, Registry };
`;
}

function devRunnerSource() {
  return `import http from "node:http";

const port = Number(process.env.SPACE_DEV_PORT || "${devPort}");
const version = process.env.SPACE_DEV_VERSION || "dev";
const application = await import("./space-dev-application.mjs");
if (typeof application.default !== "function") {
  throw new TypeError("Space App must default-export a fetch handler");
}

const server = http.createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url || "/", "http://space-dev.local");
    if (url.pathname === "/__space_dev_health") {
      outgoing.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      outgoing.end(version);
      return;
    }

    const method = incoming.method || "GET";
    const chunks = method === "GET" || method === "HEAD"
      ? []
      : await new Promise((resolve, reject) => {
          const buffered = [];
          let requestBytes = 0;
          incoming.on("data", (chunk) => {
            requestBytes += chunk.byteLength;
            if (requestBytes > ${maximumProxyBodyBytes}) {
              reject(Object.assign(new Error("Request too large"), { statusCode: 413 }));
              incoming.destroy();
              return;
            }
            buffered.push(chunk);
          });
          incoming.on("end", () => resolve(buffered));
          incoming.on("error", reject);
        });
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (Array.isArray(value)) {
        for (const item of value) headers.append(name, item);
      } else if (value !== undefined) {
        headers.set(name, value);
      }
    }
    const request = new Request(url, {
      method,
      headers,
      ...(method === "GET" || method === "HEAD"
        ? {}
        : { body: Buffer.concat(chunks), duplex: "half" }),
    });
    const response = await application.default(request);
    const responseHeaders = {};
    response.headers.forEach((value, name) => {
      responseHeaders[name] = value;
    });
    outgoing.writeHead(response.status, responseHeaders);
    if (!response.body || method === "HEAD") {
      outgoing.end();
      return;
    }
    const reader = response.body.getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!outgoing.write(Buffer.from(value))) {
        await new Promise((resolve) => outgoing.once("drain", resolve));
      }
    }
    outgoing.end();
  } catch (error) {
    const status = error && typeof error === "object" && error.statusCode === 413 ? 413 : 500;
    outgoing.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
    outgoing.end(error instanceof Error ? error.stack || error.message : String(error));
  }
});
server.listen(port, "0.0.0.0");
`;
}
