import { readFile, readdir, unlink, writeFile, mkdir } from "node:fs/promises";
import { dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { isSpaceTemplateProjectFilePath } from "@vibechat/space-templates";
import type { AgentExecutionHandle } from "../../agent-runtime/contract.js";
import {
  projectFilePaths,
  type ProjectFiles,
  validateFiles,
} from "../../project-store.js";

const decoder = new TextDecoder();

export async function loadSeed(): Promise<ProjectFiles> {
  return readLocalProjectTree(
    fileURLToPath(new URL("../../../fixtures/app", import.meta.url)),
  );
}

export async function syncHostProjectFiles(
  workspace: string,
  files: ProjectFiles,
) {
  await mkdir(workspace, { recursive: true });
  const inputPaths = projectFilePaths(files);
  const existingFiles = await readLocalProjectFileEntries(workspace);
  await Promise.all(
    Object.keys(existingFiles)
      .filter((path) => !inputPaths.includes(path))
      .map((path) => unlink(`${workspace}/${path}`)),
  );
  await Promise.all(
    inputPaths.map(async (path) => {
      await mkdir(dirname(`${workspace}/${path}`), { recursive: true });
      await writeFile(`${workspace}/${path}`, files[path], "utf8");
    }),
  );
}

export async function readHostFiles(workspace: string) {
  return readLocalProjectTree(workspace);
}

export async function writeAgentFiles(
  agent: AgentExecutionHandle,
  files: ProjectFiles,
) {
  for (const path of projectFilePaths(files)) {
    const directory = dirname(`/workspace/${path}`);
    await agent.makeDirectory(directory);
    await agent.writeFile(`/workspace/${path}`, files[path]);
  }
}

export async function readAgentFiles(
  agent: AgentExecutionHandle,
  paths: Iterable<string>,
) {
  const output: ProjectFiles = {};
  for (const path of [...paths].sort()) {
    output[path] = decoder.decode(await agent.readFile(`/workspace/${path}`));
  }
  return output;
}

async function readLocalProjectTree(root: string) {
  return validateFiles(await readLocalProjectFileEntries(root));
}

async function readLocalProjectFileEntries(root: string) {
  const files: ProjectFiles = {};
  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".pi-sessions") continue;
      const absolutePath = `${directory}/${entry.name}`;
      const projectPath = relative(root, absolutePath).split("\\").join("/");
      if (!isSpaceTemplateProjectFilePath(projectPath)) continue;
      if (entry.isDirectory()) {
        await visit(absolutePath);
      } else if (entry.isFile()) {
        files[projectPath] = await readFile(absolutePath, "utf8");
      }
    }
  }
  await visit(root);
  return files;
}
