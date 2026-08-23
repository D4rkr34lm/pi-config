import { node } from "./dependencies";
import path from "path";
import { spawn } from "child_process";
import os from "os";
import { AppRouter } from "../runtime";
import { createTRPCClient, httpBatchLink, TRPCClient } from "@trpc/client";

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

function assembleSandboxDockerFile(definition: SandboxDefinition): string {
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

function assembleIsolationVolumeMounts(
  sandboxDefinition: SandboxDefinition
): string[] {
  return sandboxDefinition.isolatedPaths.map((path) => `-v ${path}:${path}`);
}

async function buildImage(dockerfile: string, tag: string): Promise<void> {
  const docker = spawn(
    "docker",
    [
      "build",
      "--file",
      "-", // read Dockerfile from stdin
      "--tag",
      tag,
      os.homedir(), // actual build context
    ],
    {
      stdio: ["pipe", "inherit", "inherit"],
      shell: false,
    }
  );

  docker.stdin.end(dockerfile);

  await new Promise<void>((resolve, reject) => {
    docker.on("error", reject);

    docker.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`docker build exited with code ${code}`));
      }
    });
  });
}

export async function buildSandboxImage(definition: SandboxDefinition) {
  const dockerfileContent = assembleSandboxDockerFile(definition);

  const imageTag = `pi-sandbox:latest`;
  await buildImage(dockerfileContent, imageTag);
}

function getSandboxImageTag(definition: SandboxDefinition) {
  return `pi-sandbox-${definition.name}:latest`;
}

export async function doesSandboxImageExist(tag: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const docker = spawn("docker", ["images", "-q", tag], {
      stdio: ["ignore", "pipe", "inherit"],
      shell: false,
    });

    let output = "";
    docker.stdout.on("data", (data) => {
      output += data.toString();
    });

    docker.on("error", reject);

    docker.on("exit", (code) => {
      if (code === 0) {
        resolve(output.trim().length > 0);
      } else {
        reject(new Error(`docker images exited with code ${code}`));
      }
    });
  });
}

interface Sandbox {
  api: TRPCClient<AppRouter>;
}

export async function startSandbox(
  definition: SandboxDefinition,
  workspacePath: string
): Promise<Sandbox> {
  const imageTag = getSandboxImageTag(definition);

  const sandboxImageExists = await doesSandboxImageExist(imageTag);

  if (!sandboxImageExists) {
    await buildSandboxImage(definition);
  }

  const docker = spawn(
    "docker",
    [
      "run",
      "--rm",
      "-it",
      "-v",
      `${workspacePath}:/workspace`,
      ...assembleIsolationVolumeMounts(definition),
      imageTag,
    ],
    {
      stdio: "inherit",
      shell: false,
    }
  );

  await new Promise<void>((resolve, reject) => {
    docker.on("error", reject);

    docker.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`docker run exited with code ${code}`));
      }
    });
  });

  const sandboxApi = createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: "http://localhost:3000",
      }),
    ],
  });

  await Promise.all(
    definition.forbiddenPaths.map((glob) =>
      sandboxApi.fileSystem.denyAccess.mutate({ glob })
    )
  );

  await Promise.all(
    definition.runAfterStart.map((command) =>
      sandboxApi.shell.executeCommand.mutate({ command })
    )
  );

  return {
    api: sandboxApi,
  };
}
