import path from "path";
import { compact } from "lodash-es";

export function mapHostPathToSandboxPath(args: {
  hostWorkingDir: string;
  sandboxWorkingDir: string;
  hostPath: string;
}): string {
  const hostWorkingDir = path.resolve(args.hostWorkingDir);
  const hostPath = path.resolve(args.hostPath);
  const relativePath = path.relative(hostWorkingDir, hostPath);
  const isOutsideWorkspace =
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath);

  if (isOutsideWorkspace) {
    throw new Error(`Access denied: ${hostPath} is outside of the workspace.`);
  }

  return path.posix.join(
    args.sandboxWorkingDir,
    ...compact(relativePath.split(path.sep))
  );
}

export function ensureSandboxOperationSucceeded(
  result: { type: "success" } | { type: "error"; message: string }
): asserts result is { type: "success" } {
  if (result.type === "error") {
    throw new Error(`Sandbox filesystem operation failed: ${result.message}`);
  }
}
