import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import type { ExtensionSettings } from "../../../utils/extension-settings";
import { hasValue } from "../../../utils/type-guards";

const STATUS_KEY = "watchdog";
const SECTION_SEPARATOR = " • ";
const FORBIDDEN_FILES_MAX_WIDTH = 40;

type WatchdogStatusState = {
  blocked: number;
};

const formatForbiddenFiles = (forbiddenFiles: string[]): string => {
  if (forbiddenFiles.length === 0) return "forbidden: -";

  return `forbidden: ${truncateToWidth(
    forbiddenFiles.join(", "),
    FORBIDDEN_FILES_MAX_WIDTH,
    "…"
  )}`;
};

const renderWatchdogStatus = (
  ctx: ExtensionContext,
  settings: WatchdogStatusSettings,
  state: WatchdogStatusState
): string => {
  const theme = ctx.ui.theme;
  const dim = (text: string): string => theme.fg("dim", text);
  const workspace = settings.workspaceBoundary.enforce
    ? dim("workspace")
    : `${dim("workspace - ")}${theme.fg("error", "off")}`;
  const containerized = settings.containerized
    ? dim("containerized")
    : `${dim("containerized - ")}${theme.fg("error", "off")}`;
  
  const sections = [
    dim("watchdog"),
    settings.containerized ? null : workspace,
    containerized,
    dim(formatForbiddenFiles(settings.forbiddenFiles)),
  ].filter(hasValue);

  if (state.blocked > 0) sections.push(dim(`blocked - ${state.blocked}`));

  return sections.join(dim(SECTION_SEPARATOR));
};

export type WatchdogStatusController = {
  markBlocked: (ctx: ExtensionContext) => void;
};

export type WatchdogStatusSettings = ExtensionSettings<"watchdog"> & { containerized: boolean };

export function mountWatchdogStatus(
  pi: ExtensionAPI,
  settings: WatchdogStatusSettings
): WatchdogStatusController {
  const state: WatchdogStatusState = { blocked: 0 };

  const updateStatus = (ctx: ExtensionContext): void => {
    if (!ctx.hasUI) return;
    ctx.ui.setStatus(STATUS_KEY, renderWatchdogStatus(ctx, settings, state));
  };

  pi.on("session_start", (_event, ctx) => {
    updateStatus(ctx);
  });

  pi.on("session_shutdown", (_event, ctx) => {
    if (ctx.hasUI) ctx.ui.setStatus(STATUS_KEY, undefined);
  });

  return {
    markBlocked: (ctx) => {
      state.blocked += 1;
      updateStatus(ctx);
    },
  };
}
