import path from "path";
import os from "os";
import { Dependency, SandboxDefinition } from "./defineSandbox";
import { VolumeMount } from "./utils/dockerApi";

function getRuntimePath(): string {
  return path.join(
    os.homedir(),
    ".pi",
    "agent",
    "extensions",
    "sandbox",
    "runtime"
  );
}

function assembleAptInstallCommand(dependencies: Dependency[]): string {
  return `RUN apt-get update && apt-get install -y ${dependencies
    .map((dep) => `${dep.name}=${dep.version}`)
    .join(" ")} && apt-get clean && rm -rf /var/lib/apt/lists/*`;
}

function assembleNpmInstallCommand(dependencies: Dependency[]): string {
  return `RUN npm install -g ${dependencies
    .map((dep) => `${dep.name}@${dep.version}`)
    .join(" ")}`;
}

export function assembleSandboxDockerFile(
  definition: SandboxDefinition
): string {
  const baseImage = definition.base;

  const sortedDependencies = definition.dependencies.sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const aptDependencies = sortedDependencies.filter(
    (dep) => dep.origin === "apt"
  );
  const npmDependencies = sortedDependencies.filter(
    (dep) => dep.origin === "npm"
  );

  return `
  FROM ${baseImage}

  RUN mkdir /workspace && chmod 777 /workspace
  RUN mkdir /runtime && chmod 700 /runtime

  RUN useradd --shell /bin/bash sandbox

  ${assembleAptInstallCommand(aptDependencies)}

  ${assembleNpmInstallCommand(npmDependencies)}

  COPY ${getRuntimePath()} /runtime

  WORKDIR /runtime

  CMD tsx index.ts
  `;
}

export function assembleIsolationVolumeMounts(
  sandboxDefinition: SandboxDefinition
): VolumeMount[] {
  return sandboxDefinition.isolatedPaths.map((path) => ({
    source: path,
    target: path,
  }));
}
