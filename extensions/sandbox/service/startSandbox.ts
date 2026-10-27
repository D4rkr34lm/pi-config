import { AppRouter } from "../runtime/router";
import {
  createTRPCClient,
  httpBatchStreamLink,
  TRPCClient,
} from "@trpc/client";
import { SandboxDefinition } from "./defineSandbox";
import { assembleSandboxDockerFile } from "./assembleSandboxImage";
import { useSimpleDockerApi, Volume } from "./utils/dockerApi";
import { SANDBOX_WORKING_DIR } from "./constants";
import path from "path";
import { fileURLToPath } from "url";
import { range } from "lodash-es";
import { randomUUID } from "crypto";

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
    } catch (error) {
      attempts--;
      if (attempts === 0) {
        throw new Error(
          "Sandbox API did not become available after 100 attempts",
          {
            cause: error,
          }
        );
      }
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

function getSandboxPort() {
  const portRange = range(30000, 40000);
  const randomIndex = Math.floor(Math.random() * portRange.length);
  return portRange[randomIndex] ?? 30000;
}

export function assemblePrivateVolumeMounts(
  sandboxDefinition: SandboxDefinition
): Volume[] {
  return sandboxDefinition.fileSystemSettings.privatePaths.map((path) => ({
    target: path,
  }));
}

export interface Sandbox {
  workspacePath: string;
  definition: SandboxDefinition;
  authToken: string;
  api: TRPCClient<AppRouter>;
  stop: () => Promise<void>;
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

  const volumes: Volume[] = [
    {
      source: path.resolve(workspacePath),
      target: SANDBOX_WORKING_DIR,
    },
    ...assemblePrivateVolumeMounts(definition),
  ];

  const sandboxPort = getSandboxPort();
  const authToken = randomUUID();

  const containerId = await dockerApi.runContainer({
    containerName: `pi-sandbox-${definition.name}`,
    image: imageTag,
    env: { SANDBOX_AUTH_TOKEN: authToken, PORT: sandboxPort.toString() },
    volumes,
    ports: [
      {
        hostPort: sandboxPort,
        containerPort: sandboxPort,
      },
    ],
  });

  const sandboxApi = createTRPCClient<AppRouter>({
    links: [
      httpBatchStreamLink({
        url: `http://localhost:${sandboxPort}`,
      }),
    ],
  });

  const stopContainer = async (): Promise<void> => {
    await dockerApi.stopContainer(containerId);
    await dockerApi.removeContainer(containerId);
  };

  try {
    await waitForSandboxApi(sandboxApi);

    await sandboxApi.admin.setup.mutate({
      authToken,
      forbiddenGlobs: [
        "/runtime/**",
        ...definition.fileSystemSettings.forbiddenPaths,
      ],
    });

    definition.runAfterStart.forEach(async (command) => {
      await sandboxApi.shell.executeCommand.mutate({
        authToken,
        command,
      });
    });

    return {
      workspacePath,
      definition,
      authToken,
      api: sandboxApi,
      stop: stopContainer,
    };
  } catch (error) {
    await stopContainer();
    throw error;
  }
}
