import { execFile as execFileCallback } from "child_process";
import { promisify } from "util";

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
    image: string;
    volumes: VolumeMount[];
    ports: PortMapping[];
  }): Promise<string> => {
    const { image, volumes, ports } = args;

    const volumeArgs = volumes.flatMap((volume) => [
      "-v",
      `${volume.source}:${volume.target}`,
    ]);

    const portArgs = ports.flatMap((port) => [
      "-p",
      `${port.hostPort}:${port.containerPort}`,
    ]);

    const { stdout } = await execFile("docker", [
      "run",
      "--rm",
      "-it",
      ...volumeArgs,
      ...portArgs,
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

  const listImages = async (): Promise<string[]> => {
    const { stdout } = await execFile("docker", ["images", "-q"]);
    return stdout
      .trim()
      .split("\n")
      .filter((id) => id.length > 0);
  };

  return {
    buildImage,
    runContainer,
    stopContainer,
    removeContainer,
    listImages,
  };
}
