import { node } from "./dependencies";

export type BaseImage = "debian:bookworm";
export type DependencyOrigin = "apt" | "npm";

export interface Dependency {
  name: string;
  version: string;
  origin: DependencyOrigin;
}

export interface SandboxDefinition {
  name: string;
  base: BaseImage;
  forbiddenPaths: string[];
  isolatedPaths: string[];
  dependencies: Dependency[];
  runAfterStart: string[];
}

export function defineSandbox(definition: {
  name: string;
  base: BaseImage;
  forbiddenPaths?: string[];
  isolatedPaths?: string[];
  dependencies?: Array<Dependency | Dependency[]>;
  runAfterStart?: string[];
}): SandboxDefinition {
  const dependencies = definition.dependencies?.flat() ?? [];
  const dependenciesWithRequiredDefaults = dependencies.some(
    (dep) => dep.name === "node"
  )
    ? dependencies
    : [...dependencies, ...node()];

  return {
    name: definition.name,
    base: definition.base,
    forbiddenPaths: definition.forbiddenPaths ?? [],
    isolatedPaths: definition.isolatedPaths ?? [],
    dependencies: dependenciesWithRequiredDefaults,
    runAfterStart: definition.runAfterStart ?? [],
  };
}
