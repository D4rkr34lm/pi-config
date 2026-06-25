import { matchesAnyPattern } from "./pathPatterns";
import { resolveTargetPath } from "./pathUtils";
import type { PathViolation } from "./pathViolation";
import type { TargetPath } from "./toolTargetPaths";

export type ForbiddenFilesSettings = {
  forbiddenFiles?: string[];
};

export function findFirstForbiddenFileViolation(
  targetPaths: TargetPath[],
  workspacePath: string,
  forbiddenFiles: string[]
): PathViolation | undefined {
  for (const target of targetPaths) {
    const absolutePath = resolveTargetPath(target.value, workspacePath);
    if (!absolutePath) continue;

    if (matchesAnyPattern(absolutePath, workspacePath, forbiddenFiles)) {
      return {
        target,
        absolutePath,
        reason: "matches a forbidden file pattern",
      };
    }
  }

  return undefined;
}
