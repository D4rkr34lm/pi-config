import { AppRouter } from "../runtime/router";
import { createTRPCClient, httpBatchLink, TRPCClient } from "@trpc/client";
import { SandboxDefinition } from "./defineSandbox";
import {
  assembleIsolationVolumeMounts,
  assembleSandboxDockerFile,
} from "./assembleSandboxImage";
import { useSimpleDockerApi, VolumeMount } from "./utils/dockerApi";

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

interface Sandbox {
  api: TRPCClient<AppRouter>;
  stop: () => Promise<void>;
}

const SANDBOX_API_PORT = 3000;
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
      target: "/workspace",
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
    api: sandboxApi,
    stop: async () => {
      await dockerApi.stopContainer(imageTag);
      await dockerApi.removeContainer(imageTag);
    },
  };
}
