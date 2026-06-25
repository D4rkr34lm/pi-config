import path from "node:path";
import type { TargetPath } from "./toolTargetPaths";

export type PathViolation = {
  target: TargetPath;
  absolutePath: string;
  reason: string;
};

export function formatPathViolation(
  toolName: string,
  workspacePath: string,
  violation: PathViolation
): string {
  return [
    `Blocked ${toolName} tool call: ${violation.target.source} (${violation.target.value}) ${violation.reason}.`,
    `Resolved path: ${violation.absolutePath}`,
    `Workspace: ${path.resolve(workspacePath)}`,
  ].join("\n");
}
