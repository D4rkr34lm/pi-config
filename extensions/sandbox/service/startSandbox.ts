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
import { hash, randomUUID } from "crypto";
import type { SandboxStartupProgressHandler } from "./sandboxStartupProgress";
import { SandboxesCache } from "./configs/sandboxesCache";

const SANDBOX_IMAGE_VERSION = 3;

function getSandboxDefinitionHash(definition: SandboxDefinition) {
  return hash(
    "sha1",
    JSON.stringify({ imageVersion: SANDBOX_IMAGE_VERSION, definition }),
  );
}

function getSandboxImageTag(definition: SandboxDefinition) {
  return `pi-sandbox-${definition.name}-${getSandboxDefinitionHash(definition)}:latest`;
}

function getSandboxBuildContext() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

async function waitForSandboxApi(
  sandboxApi: TRPCClient<AppRouter>,
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
          },
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

async function runSandboxSetupCommand(
  sandboxApi: TRPCClient<AppRouter>,
  authToken: string,
  command: string,
): Promise<void> {
  const output = await sandboxApi.shell.executeCommand.mutate({
    authToken,
    command,
  });

  let stderr = "";

  for await (const event of output) {
    if (event.type === "exit" && event.code !== 0) {
      throw new Error(
        `Sandbox setup command failed with exit code ${event.code}: ${command}\n${stderr}`,
      );
    } else if (event.type === "stderr") {
      stderr += event.data;
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

function genrateSandboxPort() {
  const portRange = range(30000, 40000);
  const randomIndex = Math.floor(Math.random() * portRange.length);
  return portRange[randomIndex] ?? 30000;
}

function generateSandboxId(
  sandboxDefinition: SandboxDefinition,
  workspacePath: string,
): string {
  const reuseId =
    sandboxDefinition.reuseSandboxById?.(workspacePath) ?? randomUUID();
  return `pi-sandbox-${sandboxDefinition.name}-${getSandboxDefinitionHash(sandboxDefinition)}-${reuseId}`;
}

export function assemblePrivateVolumeMounts(
  sandboxDefinition: SandboxDefinition,
): Volume[] {
  return sandboxDefinition.fileSystemSettings.privatePaths.map((path) => ({
    target: `${SANDBOX_WORKING_DIR}/${path}`,
  }));
}

export interface Sandbox {
  id: string;
  containerId: string;
  workspacePath: string;
  definition: SandboxDefinition;
  authToken: string;
  port: number;
  api: TRPCClient<AppRouter>;
  stop: () => Promise<void>;
}

export async function connectToSandbox(args: {
  id: string;
  containerId: string;
  workspacePath: string;
  definition: SandboxDefinition;
  authToken: string;
  port: number;
}): Promise<Sandbox> {
  const { id, workspacePath, definition, authToken, port, containerId } = args;

  const sandboxApi = createTRPCClient<AppRouter>({
    links: [
      httpBatchStreamLink({
        url: `http://localhost:${port}`,
        maxItems: 1,
      }),
    ],
  });

  const stopContainer = async (): Promise<void> => {
    const dockerApi = useSimpleDockerApi();
    await dockerApi.stopContainer(containerId);

    if (!definition.reuseSandboxById) {
      await dockerApi.removeContainer(containerId);
    }
  };

  try {
    await waitForSandboxApi(sandboxApi);
  } catch (error) {
    await stopContainer();
    throw error;
  }

  return {
    id,
    containerId,
    port,
    workspacePath,
    definition,
    authToken,
    api: sandboxApi,
    stop: stopContainer,
  };
}

export async function startSandbox(
  definition: SandboxDefinition,
  workspacePath: string,
  onProgress?: SandboxStartupProgressHandler,
): Promise<Sandbox> {
  const dockerApi = useSimpleDockerApi();
  const sandboxId = generateSandboxId(definition, workspacePath);
  const sandboxesCache = definition.reuseSandboxById
    ? SandboxesCache.load()
    : null;
  const cachedSandbox = sandboxesCache?.get(sandboxId);

  if (cachedSandbox) {
    onProgress?.({
      phase: "starting-container",
      definitionName: definition.name,
    });
    await dockerApi.startContainer(cachedSandbox.containerId);

    onProgress?.({
      phase: "waiting-for-api",
      definitionName: definition.name,
    });
    return connectToSandbox({
      id: sandboxId,
      containerId: cachedSandbox.containerId,
      workspacePath,
      definition,
      authToken: cachedSandbox.authToken,
      port: cachedSandbox.sandboxPort,
    });
  }

  const imageTag = getSandboxImageTag(definition);

  onProgress?.({
    phase: "checking-image",
    definitionName: definition.name,
  });
  const sandboxImageExists = await doesSandboxImageExist(imageTag);

  if (!sandboxImageExists) {
    onProgress?.({
      phase: "building-image",
      definitionName: definition.name,
    });
    await buildSandboxImage(definition);
  }

  const privateVolumes = assemblePrivateVolumeMounts(definition);
  const volumes: Volume[] = [
    {
      source: path.resolve(workspacePath),
      target: SANDBOX_WORKING_DIR,
    },
    ...privateVolumes,
  ];

  const sandboxPort = genrateSandboxPort();
  const authToken = randomUUID();

  onProgress?.({
    phase: "starting-container",
    definitionName: definition.name,
  });
  const containerId = await dockerApi.runContainer({
    containerName: sandboxId,
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

  try {
    onProgress?.({
      phase: "waiting-for-api",
      definitionName: definition.name,
    });

    const sandbox = await connectToSandbox({
      id: sandboxId,
      workspacePath,
      definition,
      authToken,
      port: sandboxPort,
      containerId,
    });

    const { api: sandboxApi } = sandbox;

    onProgress?.({
      phase: "applying-policy",
      definitionName: definition.name,
    });
    await sandboxApi.admin.setup.mutate({
      authToken,
      forbiddenGlobs: [
        "/runtime/**",
        ...definition.fileSystemSettings.forbiddenPaths,
      ],
      writablePaths: privateVolumes.map(({ target }) => target),
    });

    for (const command of definition.runAfterStart) {
      onProgress?.({
        phase: "running-setup",
        definitionName: definition.name,
        commandIndex: definition.runAfterStart.indexOf(command) + 1,
        commandCount: definition.runAfterStart.length,
      });
      await runSandboxSetupCommand(sandboxApi, authToken, command);
    }

    sandboxesCache?.set({
      id: sandboxId,
      containerId,
      sandboxPort,
      authToken,
    });

    return sandbox;
  } catch (error) {
    throw error;
  }
}
