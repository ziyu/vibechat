import {
  composeSpaceAppManagedPackageRegistries,
  prepareSpaceAppProject,
  type SpaceAppManagedPackageRegistry,
} from "@vibechat/space-app-dependencies";
import { createSpaceAppComponentManagedRegistry } from "@vibechat/space-app-components/node";
import {
  validateFiles,
  validatePreparedProject,
  type ProjectFiles,
  type StoredProject,
} from "./project-store.js";

export type PreparedProject = NonNullable<StoredProject["prepared"]>;

export type ProjectDependencyPreparer = (
  files: ProjectFiles,
  prepared?: PreparedProject,
) => Promise<PreparedProject>;

export function createProjectDependencyPreparer(
  registry: SpaceAppManagedPackageRegistry =
    composeSpaceAppManagedPackageRegistries([
      createSpaceAppComponentManagedRegistry(),
    ]),
): ProjectDependencyPreparer {
  return async (files, prepared) => {
    const sourceFiles = validateFiles(files);
    if (prepared) return validatePreparedProject(sourceFiles, prepared);
    const resolved = await prepareSpaceAppProject({
      files: sourceFiles,
      registry,
      projectFormat: "agentos-app-v1",
      managedScopes: ["@vibechat/"],
    });
    return validatePreparedProject(sourceFiles, resolved);
  };
}

export const prepareProjectDependencies = createProjectDependencyPreparer();
