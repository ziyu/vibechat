import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const editablePaths = [
  "package.json",
  "tsconfig.json",
  "src/index.ts",
] as const;

export type ProjectFiles = Record<(typeof editablePaths)[number], string>;

export interface StoredProject {
  appId: string;
  files: ProjectFiles;
  summary: string;
  updatedAt: string;
  draftId?: string;
  publishedDraftId?: string;
  releaseId?: string;
}

const dataDirectory = join(process.cwd(), ".data", "projects");
const maximumFileBytes = 96 * 1024;

function projectPath(appId: string) {
  return join(dataDirectory, `${appId}.json`);
}

export function assertAppId(appId: string) {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/.test(appId)) {
    throw new TypeError(
      "appId must contain 1-48 lowercase letters, numbers, or hyphens",
    );
  }
}

export function validateFiles(value: unknown): ProjectFiles {
  if (!value || typeof value !== "object") {
    throw new TypeError("model response must contain a files object");
  }

  const source = value as Record<string, unknown>;
  const files = {} as ProjectFiles;
  for (const path of editablePaths) {
    const content = source[path];
    if (typeof content !== "string") {
      throw new TypeError(`model response is missing ${path}`);
    }
    if (Buffer.byteLength(content) > maximumFileBytes) {
      throw new RangeError(`${path} exceeds ${maximumFileBytes} bytes`);
    }
    files[path] = content;
  }
  return files;
}

export async function loadProject(appId: string): Promise<StoredProject | null> {
  assertAppId(appId);
  try {
    const contents = await readFile(projectPath(appId), "utf8");
    const project = JSON.parse(contents) as StoredProject;
    return { ...project, files: validateFiles(project.files) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function saveProject(project: StoredProject) {
  assertAppId(project.appId);
  await mkdir(dataDirectory, { recursive: true });
  const path = projectPath(project.appId);
  const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(project, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
}

export function projectDirectory() {
  return dirname(projectPath("placeholder"));
}
