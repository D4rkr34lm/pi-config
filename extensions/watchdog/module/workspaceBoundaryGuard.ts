import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getToolTargetPaths } from "../utils/toolTargetPaths";
import { formatPathViolation } from "../utils/pathViolation";
import { findFirstWorkspaceBoundaryViolation } from "../utils/workspaceBoundary";
import { ExtensionSettings } from "../../../utils/extension-settings";

export function mountWorkspaceBoundaryGuard(
  pi: ExtensionAPI,
  settings: ExtensionSettings<"watchdog">["workspaceBoundary"],
  onBlock?: (ctx: ExtensionContext) => void
): void {
  pi.on("tool_call", (event, ctx) => {
    if (!settings.enforce) return;

    const targetPaths = getToolTargetPaths(event);
    const violation = findFirstWorkspaceBoundaryViolation(
      targetPaths,
      ctx.cwd,
      settings
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
