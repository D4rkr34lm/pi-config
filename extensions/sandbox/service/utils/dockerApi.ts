import { execFile as execFileCallback } from "child_process";
import { promisify } from "util";
import { hasValue } from "../../../../utils/type-guards";

const execFile = promisify(execFileCallback);

export interface VolumeMount {
  source: string;
  target: string;
}

interface PortMapping {
  hostPort: number;
  containerPort: number;
}

export function useSimpleDockerApi() {
  const buildImage = async (args: {
    dockerfile: string;
    tag: string;
    context: string;
  }): Promise<void> => {
    const { dockerfile, tag, context } = args;

    const buildProcess = execFile("docker", [
      "build",
      "--file",
      "-",
      "--tag",
      tag,
      context,
    ]);

    buildProcess.child.stdin?.end(dockerfile);

    await buildProcess;
  };

  const runContainer = async (args: {
    containerName?: string;
    image: string;
    volumes: VolumeMount[];
    ports: PortMapping[];
    env: Record<string, string>;
  }): Promise<string> => {
    const { containerName, image, volumes, ports, env = {} } = args;

    const volumeArgs = volumes.flatMap((volume) => [
      "-v",
      `${volume.source}:${volume.target}`,
    ]);

    const portArgs = ports.flatMap((port) => [
      "-p",
      `${port.hostPort}:${port.containerPort}`,
    ]);

    const envArgs = Object.entries(env).flatMap(([name, value]) => [
      "--env",
      `${name}=${value}`,
    ]);

    const nameArgs = hasValue(containerName) ? ["--name", containerName] : [];

    const { stdout } = await execFile("docker", [
      "run",
      "--detach",
      ...nameArgs,
      ...volumeArgs,
      ...portArgs,
      ...envArgs,
      image,
    ]);

    return stdout.trim();
  };

  const stopContainer = async (containerId: string): Promise<void> => {
    await execFile("docker", ["stop", containerId]);
  };

  const removeContainer = async (containerId: string): Promise<void> => {
    await execFile("docker", ["rm", containerId]);
  };

  const listContainers = async (
    options: { all?: boolean } = {}
  ): Promise<string[]> => {
    const { all = false } = options;
    const args = ["ps", "--no-trunc", "--format", "{{.ID}}"];
    if (all) {
      args.push("-a");
    }

    const { stdout } = await execFile("docker", args);
    return stdout
      .trim()
      .split("\n")
      .filter((id) => id.length > 0);
  };

  const listImages = async (): Promise<string[]> => {
    const { stdout } = await execFile("docker", [
      "images",
      "--format",
      "{{.Repository}}:{{.Tag}}",
    ]);
    return stdout
      .trim()
      .split("\n")
      .filter((id) => id.length > 0);
  };

  const removeImage = async (imageId: string): Promise<void> => {
    await execFile("docker", ["rmi", imageId]);
  };

  return {
    buildImage,
    runContainer,
    stopContainer,
    removeContainer,
    listImages,
    removeImage,
    listContainers,
  };
}
