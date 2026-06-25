import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getToolTargetPaths } from "../utils/toolTargetPaths";
import { findFirstForbiddenFileViolation } from "../utils/forbiddenFiles";
import { formatPathViolation } from "../utils/pathViolation";

export function mountForbiddenFilesGuard(
  pi: ExtensionAPI,
  forbiddenFiles: string[],
  onBlock?: (ctx: ExtensionContext) => void
): void {
  pi.on("tool_call", (event, ctx) => {
    const targetPaths = getToolTargetPaths(event);
    const violation = findFirstForbiddenFileViolation(
      targetPaths,
      ctx.cwd,
      forbiddenFiles
    );
    if (violation) {
      onBlock?.(ctx);
      return {
        block: true,
        reason: formatPathViolation(event.toolName, ctx.cwd, violation),
      };
    }
  });
}
