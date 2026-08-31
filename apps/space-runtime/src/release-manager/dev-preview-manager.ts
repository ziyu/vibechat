import { createHash } from "node:crypto";
import { posix } from "node:path";
import ts from "typescript";
import type {
  AppCandidateHandle,
  AppExecutionRuntime,
} from "../app-runtime/contract.js";
import { assertAppId } from "../app-id.js";
import {
  projectFilePaths,
  type ProjectFiles,
} from "../project-store.js";

const workspace = "/workspace";
const devPort = 4173;
const runnerPath = `${workspace}/space-dev-runner.mjs`;
const devBuildRoot = `${workspace}/.space-dev`;
const rivetKitShimPath = `${workspace}/space-dev-rivetkit.mjs`;
const maximumProxyBodyBytes = 4 * 1024 * 1024;
const maximumRetainedReadyPreviews = 3;
const decoder = new TextDecoder();
const devSessionId = `${process.pid}-${Date.now().toString(36)}`;

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

interface ReadyDevPreview extends DevPreviewResult {
  actorKey: string;
  pid: number;
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
  readonly #readyPreviews = new Map<string, Map<string, ReadyDevPreview>>();
  readonly #latestReadyVersions = new Map<string, string>();
  readonly #active = new Map<
    string,
    { version: string; promise: Promise<DevPreviewResult> }
  >();
  readonly #runtime: AppExecutionRuntime;

  constructor(runtime: AppExecutionRuntime) {
    this.#runtime = runtime;
  }

  status(spaceInstanceId: string): DevPreviewStatus {
    assertAppId(spaceInstanceId);
    return this.#statuses.get(spaceInstanceId) ?? { state: "idle" };
  }

  prepare(
    spaceInstanceId: string,
    files: ProjectFiles,
    onStatus?: StatusReporter,
  ): Promise<DevPreviewResult> {
    assertAppId(spaceInstanceId);
    const version = draftVersion(files);
    const retained = this.#readyPreviews.get(spaceInstanceId)?.get(version);
    if (retained) {
      if (!this.#active.has(spaceInstanceId)) {
        this.#latestReadyVersions.set(spaceInstanceId, version);
        this.#statuses.set(spaceInstanceId, {
          state: "ready",
          version,
          updatedAt: retained.updatedAt,
        });
      }
      return Promise.resolve({
        version,
        updatedAt: retained.updatedAt,
        url: devPreviewUrl(spaceInstanceId, version),
      });
    }
    const active = this.#active.get(spaceInstanceId);
    if (active?.version === version) return active.promise;

    const previous = active?.promise.catch(() => undefined) ?? Promise.resolve();
    const promise = previous
      .then(() => this.#build(spaceInstanceId, files, version, onStatus))
      .finally(() => {
        if (this.#active.get(spaceInstanceId)?.promise === promise) {
          this.#active.delete(spaceInstanceId);
        }
      });
    this.#active.set(spaceInstanceId, { version, promise });
    return promise;
  }

  async fetch(
    spaceInstanceId: string,
    url: string,
    request: {
      method: string;
      headers: Record<string, string>;
      body?: Uint8Array;
    },
  ) {
    assertAppId(spaceInstanceId);
    if (request.body && request.body.byteLength > maximumProxyBodyBytes) {
      throw new DevPreviewError(
        `dev preview request exceeds ${maximumProxyBodyBytes} bytes`,
      );
    }
    const requestedVersion = devPreviewVersionFromUrl(url);
    const version =
      requestedVersion ?? this.#latestReadyVersions.get(spaceInstanceId);
    const preview = version
      ? this.#readyPreviews.get(spaceInstanceId)?.get(version)
      : undefined;
    if (!preview) {
      throw new DevPreviewError(
        requestedVersion
          ? `Space ready Revision ${requestedVersion} is unavailable`
          : "Space 开发预览尚未就绪",
      );
    }
    return this.#runtime.openCandidate(preview.actorKey).fetch(devPort, url, {
      method: request.method,
      headers: request.headers,
      ...(request.body ? { body: request.body } : {}),
    });
  }

  async #build(
    spaceInstanceId: string,
    files: ProjectFiles,
    version: string,
    onStatus?: StatusReporter,
  ): Promise<DevPreviewResult> {
    this.#statuses.set(spaceInstanceId, { state: "building", version });
    const actorKey = devActorKey(spaceInstanceId, version);
    const candidate = this.#runtime.openCandidate(actorKey);

    try {
      await onStatus?.("正在同步到 Space Dev VM…");
      const sourcePaths = projectFilePaths(files);
      const sourceDirectories = new Set(
        sourcePaths
          .map((path) => posix.dirname(path))
          .filter((path) => path !== "."),
      );
      for (const directory of [...sourceDirectories].sort()) {
        await candidate.makeDirectory(`${workspace}/${directory}`);
      }
      await candidate.writeFiles(
        sourcePaths.map((path) => ({
          path: `${workspace}/${path}`,
          content: files[path],
        })),
      );

      await onStatus?.("正在快速转译开发版本…");
      const compiled = compileDevProject(files);
      const buildDirectories = new Set(
        compiled.files
          .map((file) => posix.dirname(file.path))
          .filter((path) => path !== "."),
      );
      for (const directory of [...buildDirectories].sort()) {
        await candidate.makeDirectory(`${devBuildRoot}/${directory}`);
      }
      await candidate.writeFiles([
        ...compiled.files.map((file) => ({
          path: `${devBuildRoot}/${file.path}`,
          content: file.content,
        })),
        { path: rivetKitShimPath, content: rivetKitShim(compiled.imports) },
        { path: runnerPath, content: devRunnerSource() },
      ]);
      await onStatus?.("正在重载 Space 开发应用…");
      const process = await candidate.start({
        entryPath: runnerPath,
        cwd: workspace,
        env: {
          SPACE_DEV_PORT: String(devPort),
          SPACE_DEV_VERSION: version,
        },
      });
      await waitUntilReady(candidate, process.processId, version);

      const updatedAt = new Date().toISOString();
      await this.#retainReadyPreview(spaceInstanceId, {
        version,
        updatedAt,
        url: devPreviewUrl(spaceInstanceId, version),
        actorKey,
        pid: process.processId,
      });
      this.#statuses.set(spaceInstanceId, {
        state: "ready",
        version,
        updatedAt,
      });
      return {
        version,
        updatedAt,
        url: devPreviewUrl(spaceInstanceId, version),
      };
    } catch (error) {
      const normalized = normalizeDevError(error);
      this.#statuses.set(spaceInstanceId, {
        state: "failed",
        version,
        error: normalized.message,
      });
      throw normalized;
    }
  }

  async #retainReadyPreview(
    spaceInstanceId: string,
    preview: ReadyDevPreview,
  ) {
    let retained = this.#readyPreviews.get(spaceInstanceId);
    if (!retained) {
      retained = new Map();
      this.#readyPreviews.set(spaceInstanceId, retained);
    }
    retained.delete(preview.version);
    retained.set(preview.version, preview);
    this.#latestReadyVersions.set(spaceInstanceId, preview.version);

    while (retained.size > maximumRetainedReadyPreviews) {
      const oldest = retained.entries().next().value as
        | [string, ReadyDevPreview]
        | undefined;
      if (!oldest) break;
      retained.delete(oldest[0]);
      await this.#runtime.openCandidate(oldest[1].actorKey).stop(oldest[1].pid)
        .catch(() => undefined);
    }
  }
}

export function draftVersion(files: ProjectFiles) {
  const hash = createHash("sha256");
  for (const path of projectFilePaths(files)) {
    hash.update(path).update("\0").update(files[path]).update("\0");
  }
  return hash.digest("hex").slice(0, 16);
}

export function devPreviewUrl(spaceInstanceId: string, version: string) {
  return `/runtime/dev/apps/${encodeURIComponent(spaceInstanceId)}/?version=${encodeURIComponent(version)}`;
}

function devPreviewVersionFromUrl(url: string) {
  const search = new URL(url).searchParams;
  return search.get("version") ?? search.get("draft");
}

function devActorKey(spaceInstanceId: string, version: string) {
  return `space-dev-${devSessionId}-${spaceInstanceId}-${version}`;
}

async function waitUntilReady(
  candidate: AppCandidateHandle,
  pid: number,
  version: string,
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await candidate.fetch(
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
    output = await candidate.readOutput(pid);
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

function compileDevProject(project: ProjectFiles) {
  const imports = new Set<string>();
  const output = new Map<string, string>();
  for (const path of projectFilePaths(project)) {
    const source = project[path];
    if (!/\.tsx?$/.test(path)) {
      output.set(path, source);
      continue;
    }
    const sourceFile = ts.createSourceFile(
      path,
      source,
      ts.ScriptTarget.ES2022,
      true,
      path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
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
        jsx: ts.JsxEmit.ReactJSX,
      },
      fileName: path,
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
          if (diagnostic.start === undefined) return `${path}: ${message}`;
          const position = sourceFile.getLineAndCharacterOfPosition(diagnostic.start);
          return `${path}:${position.line + 1}:${position.character + 1} ${message}`;
        })
        .join("\n");
      throw new DevPreviewError("开发版本存在 TypeScript 语法错误", diagnostics);
    }

    const code = result.outputText
      .replace(
        /(\bfrom\s*)(["'])rivetkit(?:\/[^"']*)?\2/g,
        (_match, prefix: string, quote: string) =>
          `${prefix}${quote}file://${rivetKitShimPath}${quote}`,
      )
      .replace(
        /(^\s*import\s*)(["'])rivetkit(?:\/[^"']*)?\2/gm,
        (_match, prefix: string, quote: string) =>
          `${prefix}${quote}file://${rivetKitShimPath}${quote}`,
      )
      .replace(
        /(\bimport\s*\(\s*)(["'])rivetkit(?:\/[^"']*)?\2/g,
        (_match, prefix: string, quote: string) =>
          `${prefix}${quote}file://${rivetKitShimPath}${quote}`,
      );
    const outputPath = path.replace(/\.tsx?$/, ".js");
    if (output.has(outputPath) && outputPath !== path) {
      throw new DevPreviewError(`开发项目的输出路径冲突：${outputPath}`);
    }
    output.set(outputPath, code);
  }
  if (!output.has("src/index.js")) {
    throw new DevPreviewError("开发项目缺少可执行入口 src/index.ts");
  }
  return {
    files: [...output].map(([path, content]) => ({ path, content })),
    imports,
  };
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
const application = await import("./.space-dev/src/index.js");
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
