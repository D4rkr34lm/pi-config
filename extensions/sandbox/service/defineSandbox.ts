const DEFAULT_NODE_VERSION = "24";
const DEFAULT_NPM_VERSION = "12";
const DEFAULT_TSX_VERSION = "4.20.6";

export type BaseImage = "debian:bookworm";

export interface Dependencies {
  node: string;
  npm: string;
  tsx: string;
}

export interface SandboxDefinition {
  name: string;
  forbiddenPaths: string[];
  isolatedPaths: string[];
  dependencies: Dependencies;
  runAfterStart: string[];
}

export function defineSandbox(definition: {
  name: string;
  forbiddenPaths?: string[];
  isolatedPaths?: string[];
  dependencies?: Partial<Dependencies>;
  runAfterStart?: string[];
}): SandboxDefinition {
  return {
    name: definition.name,
    forbiddenPaths: definition.forbiddenPaths ?? [],
    isolatedPaths: definition.isolatedPaths ?? [],
    dependencies: {
      node: DEFAULT_NODE_VERSION,
      npm: DEFAULT_NPM_VERSION,
      tsx: DEFAULT_TSX_VERSION,
      ...definition.dependencies,
    },
    runAfterStart: definition.runAfterStart ?? [],
  };
}
