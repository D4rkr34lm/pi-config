import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadExtensionSettings } from "../../utils/extension-settings";
import { mountForbiddenFilesGuard } from "./module/forbiddenFilesGuard";
import { mountWorkspaceBoundaryGuard } from "./module/workspaceBoundaryGuard";
import { mountWatchdogStatus } from "./module/status";

export default async function (pi: ExtensionAPI): Promise<void> {
  const settings = await loadExtensionSettings("watchdog");
  const status = mountWatchdogStatus(pi, settings);

  mountForbiddenFilesGuard(pi, settings.forbiddenFiles, status.markBlocked);
  mountWorkspaceBoundaryGuard(
    pi,
    settings.workspaceBoundary,
    status.markBlocked
  );
}
