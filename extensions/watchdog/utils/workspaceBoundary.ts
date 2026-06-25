import { ExtensionSettings } from "../../../utils/extension-settings";
import { matchesAnyPattern } from "./pathPatterns";
import { isInsidePath, resolveTargetPath } from "./pathUtils";
import type { PathViolation } from "./pathViolation";
import type { TargetPath } from "./toolTargetPaths";

export function findFirstWorkspaceBoundaryViolation(
  targetPaths: TargetPath[],
  workspacePath: string,
  settings: ExtensionSettings<"watchdog">["workspaceBoundary"]
): PathViolation | undefined {
  for (const target of targetPaths) {
    const absolutePath = resolveTargetPath(target.value, workspacePath);
    if (!absolutePath) continue;

    if (isInsidePath(absolutePath, workspacePath)) {
      continue;
    }

    if (matchesAnyPattern(absolutePath, workspacePath, settings.allowedFiles)) {
      continue;
    }

    return {
      target,
      absolutePath,
      reason: "resolves outside the workspace",
    };
  }

  return undefined;
}
