import { AppRouter } from "../runtime/router";
import { createTRPCClient, httpBatchLink, TRPCClient } from "@trpc/client";
import { SandboxDefinition } from "./defineSandbox";
import {
  assembleIsolationVolumeMounts,
  assembleSandboxDockerFile,
} from "./assembleSandboxImage";
import { useSimpleDockerApi, VolumeMount } from "./utils/dockerApi";
import { SANDBOX_API_PORT, SANDBOX_WORKING_DIR } from "./constants";
import path from "path";

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

async function doesSandboxImageExist(imageTag: string): Promise<boolean> {
  const dockerApi = useSimpleDockerApi();

  const allImages = await dockerApi.listImages();
  return allImages.some((image) => image.includes(imageTag));
}

export interface Sandbox {
  workspacePath: string;
  definition: SandboxDefinition;
  api: TRPCClient<AppRouter>;
  stop: () => Promise<void>;
  isPathProtected: (path: string) => boolean;
}

export async function startSandbox(
  definition: SandboxDefinition,
  workspacePath: string
): Promise<Sandbox> {
  const dockerApi = useSimpleDockerApi();

  const imageTag = getSandboxImageTag(definition);

  const sandboxImageExists = await doesSandboxImageExist(imageTag);

  if (!sandboxImageExists) {
    await buildSandboxImage(definition);
  }

  const volumeMounts: VolumeMount[] = [
    {
      source: workspacePath,
      target: SANDBOX_WORKING_DIR,
    },
    ...assembleIsolationVolumeMounts(definition),
  ];

  dockerApi.runContainer({
    image: imageTag,
    volumes: volumeMounts,
    ports: [
      {
        hostPort: SANDBOX_API_PORT,
        containerPort: SANDBOX_API_PORT,
      },
    ],
  });

  const sandboxApi = createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `http://localhost:${SANDBOX_API_PORT}`,
      }),
    ],
  });

  const forbiddenGlobs = ["/runtime/**", ...definition.forbiddenPaths];
  await Promise.all(
    forbiddenGlobs.map((glob) =>
      sandboxApi.fileSystem.denyAccess.mutate({ glob })
    )
  );

  const runAfterStartCommands = definition.runAfterStart;
  await Promise.all(
    runAfterStartCommands.map((command) =>
      sandboxApi.shell.executeCommand.mutate({ command })
    )
  );

  return {
    workspacePath,
    definition,
    api: sandboxApi,
    stop: async () => {
      await dockerApi.stopContainer(imageTag);
      await dockerApi.removeContainer(imageTag);
    },
    isPathProtected: (absolutePath: string) => {
      return forbiddenGlobs.some((glob) =>
        path.matchesGlob(absolutePath, glob)
      );
    },
  };
}
