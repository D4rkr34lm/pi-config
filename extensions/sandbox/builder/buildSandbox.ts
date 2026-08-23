import { node } from "./dependencies";
import path from "path";
import { spawn } from "child_process";
import os from "os";
import { AppRouter } from "../runtime";
import { createTRPCClient, httpBatchLink, TRPCClient } from "@trpc/client";
import { SandboxDefinition } from "./defineSandbox";
import { assembleSandboxDockerFile } from "./assembleSandboxImage";
import { useSimpleDockerApi } from "./dockerApi";

function getSandboxImageTag(definition: SandboxDefinition) {
  return `pi-sandbox-${definition.name}:latest`;
}

async function buildSandboxImage(definition: SandboxDefinition) {
  const dockerApi = useSimpleDockerApi();
  const dockerfileContent = assembleSandboxDockerFile(definition);

  const imageTag = getSandboxImageTag(definition);
  await dockerApi.buildImage({
    dockerfile: dockerfileContent,
    tag: imageTag,
    context: "~",
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
