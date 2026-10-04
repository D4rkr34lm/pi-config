export function mapHostPathToSandboxPath(args: {
  hostWorkingDir: string;
  sandboxWorkingDir: string;
  hostPath: string;
}): string {
  const { hostWorkingDir, sandboxWorkingDir, hostPath } = args;

  return hostPath.replace(hostWorkingDir, sandboxWorkingDir);
}
