import { AppRouter } from "../runtime/router";
import {
  createTRPCClient,
  httpBatchStreamLink,
  TRPCClient,
} from "@trpc/client";
import { SandboxDefinition } from "./defineSandbox";
import {
  assemblePrivateVolumeMounts,
  assembleSandboxDockerFile,
} from "./assembleSandboxImage";
import { useSimpleDockerApi, VolumeMount } from "./utils/dockerApi";
import { SANDBOX_API_PORT, SANDBOX_WORKING_DIR } from "./constants";
import path from "path";
import { fileURLToPath } from "url";

function getSandboxImageTag(definition: SandboxDefinition) {
  return `pi-sandbox-${definition.name}:latest`;
}

function getSandboxBuildContext() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

async function waitForSandboxApi(
  sandboxApi: TRPCClient<AppRouter>
): Promise<void> {
  let attempts = 100;

  while (attempts > 0) {
    try {
      await sandboxApi.admin.isAvailable.query();
      return;
    } catch {
      attempts--;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

async function buildSandboxImage(definition: SandboxDefinition) {
  const dockerApi = useSimpleDockerApi();
  const dockerfileContent = assembleSandboxDockerFile(definition);

  const imageTag = getSandboxImageTag(definition);
  await dockerApi.buildImage({
    dockerfile: dockerfileContent,
    tag: imageTag,
    context: getSandboxBuildContext(),
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
      source: path.resolve(workspacePath),
      target: SANDBOX_WORKING_DIR,
    },
    ...assemblePrivateVolumeMounts(definition),
  ];

  const containerId = await dockerApi.runContainer({
    containerName: `pi-sandbox-${definition.name}`,
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
      httpBatchStreamLink({
        url: `http://localhost:${SANDBOX_API_PORT}`,
      }),
    ],
  });

  const stopContainer = async (): Promise<void> => {
    await dockerApi.stopContainer(containerId);
    await dockerApi.removeContainer(containerId);
  };

  const forbiddenGlobs = ["/runtime/**", ...definition.forbiddenPaths];

  try {
    await waitForSandboxApi(sandboxApi);

    await Promise.all(
      forbiddenGlobs.map((glob) =>
        sandboxApi.fileSystem.denyAccess.mutate({ glob })
      )
    );
    await Promise.all(
      definition.runAfterStart.map((command) =>
        sandboxApi.shell.executeCommand.mutate({ command })
      )
    );
  } catch (error) {
    await stopContainer();
    throw error;
  }

  return {
    workspacePath,
    definition,
    api: sandboxApi,
    stop: stopContainer,
    isPathProtected: (absolutePath: string) => {
      return forbiddenGlobs.some((glob) =>
        path.matchesGlob(absolutePath, glob)
      );
    },
  };
}
