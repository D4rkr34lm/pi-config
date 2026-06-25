import { homedir } from "node:os";
import path from "node:path";

export function resolveTargetPath(
  targetPath: string,
  workspacePath: string
): string | undefined {
  const trimmedPath = targetPath.trim();
  if (!trimmedPath || trimmedPath === "-") return undefined;

  return path.resolve(
    expandShellPath(workspacePath),
    expandShellPath(trimmedPath)
  );
}

export function expandShellPath(value: string): string {
  if (value === "~") return homedir();
  if (value.startsWith("~/") || value.startsWith("~\\")) {
    return path.join(homedir(), value.slice(2));
  }

  if (process.platform === "win32") {
    const gitBashDrivePath = /^\/([A-Za-z])\/(.*)$/.exec(value);
    if (gitBashDrivePath) {
      const [, drive, rest] = gitBashDrivePath;
      return `${drive}:/${rest}`;
    }
  }

  return value;
}

export function isInsidePath(candidatePath: string, rootPath: string): boolean {
  const candidate = normalizeForComparison(candidatePath);
  const root = normalizeForComparison(rootPath);

  return candidate === root || candidate.startsWith(`${root}/`);
}

export function isAbsoluteLikePath(value: string): boolean {
  return (
    path.isAbsolute(value) ||
    /^[A-Za-z]:[\\/]/.test(value) ||
    /^\\\\[^\\/]+[\\/][^\\/]+/.test(value) ||
    (process.platform === "win32" && /^\/[A-Za-z]\//.test(value))
  );
}

export function hasPathSeparator(value: string): boolean {
  return value.includes("/") || value.includes("\\");
}

export function normalizeForComparison(value: string): string {
  const resolved = path.resolve(expandShellPath(value));
  const normalized = normalizePathSeparators(resolved).replace(/\/+$/u, "");

  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

export function normalizePathSeparators(value: string): string {
  return value.replace(/\\/gu, "/");
}
