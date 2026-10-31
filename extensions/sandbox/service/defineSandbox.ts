export interface Dependencies {
  node?: string | true;
  npm?: string | true;
  tsx?: string | true;
  bun?: string | true;
}

export type DependencyName = keyof Dependencies;

export interface FileSystemSettings {
  privatePaths: string[];
  forbiddenPaths: string[];
}

export interface SandboxDefinition {
  name: string;
  fileSystemSettings: FileSystemSettings;
  dependencies: Dependencies;
  runAfterStart: string[];
}

export function defineSandbox(definition: {
  name: string;
  forbiddenPaths?: string[];
  privatePaths?: string[];
  dependencies?: Partial<Dependencies>;
  runAfterStart?: string[];
}): SandboxDefinition {
  return {
    name: definition.name,
    fileSystemSettings: {
      privatePaths: definition.privatePaths ?? [],
      forbiddenPaths: definition.forbiddenPaths ?? [],
    },
    dependencies: definition.dependencies ?? {},
    runAfterStart: definition.runAfterStart ?? [],
  };
}
