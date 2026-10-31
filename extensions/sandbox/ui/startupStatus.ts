import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Loader } from "@earendil-works/pi-tui";
import { formatDuration } from "../../../utils/formatting";
import type { SandboxStartupProgressEvent } from "../service/sandboxStartupProgress";

const SANDBOX_STATUS_KEY = "sandbox-status";
const SANDBOX_STARTUP_WIDGET_KEY = "sandbox-startup";

function describeProgress(progress: SandboxStartupProgressEvent): string {
  switch (progress.phase) {
    case "checking-image":
      return "Checking Docker and image";
    case "building-image":
      return "Building image (first launch may take a few minutes)";
    case "starting-container":
      return "Starting container";
    case "waiting-for-api":
      return "Waiting for sandbox API";
    case "applying-policy":
      return "Applying filesystem policy";
    case "running-setup":
      return `Running setup command ${progress.commandIndex}/${progress.commandCount}`;
    case "activating-tools":
      return "Activating sandbox tools";
  }
}

export function createSandboxStartupUi(ctx: ExtensionContext) {
  const startedAt = Date.now();
  let currentProgress: SandboxStartupProgressEvent | undefined;
  let updateLoader: (() => void) | undefined;

  const formatLoaderMessage = () => {
    const elapsed = formatDuration(Date.now() - startedAt);
    if (currentProgress === undefined) {
      return `Sandbox · Preparing · ${elapsed}`;
    }

    return `Sandbox · ${currentProgress.definitionName} · ${describeProgress(
      currentProgress
    )} · ${elapsed}`;
  };

  const showStartupWidget = () => {
    if (ctx.mode !== "tui") return;

    ctx.ui.setWidget(SANDBOX_STARTUP_WIDGET_KEY, (tui, theme) => {
      const loader = new Loader(
        tui,
        (text) => theme.fg("accent", text),
        (text) => theme.fg("muted", text),
        formatLoaderMessage()
      );
      const refreshMessage = () => loader.setMessage(formatLoaderMessage());
      const elapsedTimer = setInterval(refreshMessage, 1_000);
      updateLoader = refreshMessage;

      return Object.assign(loader, {
        dispose: () => {
          clearInterval(elapsedTimer);
          loader.stop();
          if (updateLoader === refreshMessage) updateLoader = undefined;
        },
      });
    });
  };

  const clearStartupWidget = () => {
    if (ctx.mode === "tui") {
      ctx.ui.setWidget(SANDBOX_STARTUP_WIDGET_KEY, undefined);
    }
  };

  return {
    start() {
      showStartupWidget();
      const icon = ctx.ui.theme.fg("accent", "◌");
      const status = ctx.ui.theme.fg("dim", "Sandbox: preparing");
      ctx.ui.setStatus(SANDBOX_STATUS_KEY, `${icon} ${status}`);
    },
    update(progress: SandboxStartupProgressEvent) {
      currentProgress = progress;
      updateLoader?.();

      const icon = ctx.ui.theme.fg("accent", "◌");
      const status = ctx.ui.theme.fg(
        "dim",
        `Sandbox: ${progress.definitionName} · ${describeProgress(progress)}`
      );
      ctx.ui.setStatus(SANDBOX_STATUS_KEY, `${icon} ${status}`);
    },
    ready(definitionName: string) {
      clearStartupWidget();
      const icon = ctx.ui.theme.fg("success", "✓");
      const status = ctx.ui.theme.fg("dim", `Sandbox: ${definitionName}`);
      ctx.ui.setStatus(SANDBOX_STATUS_KEY, `${icon} ${status}`);
    },
    disabled() {
      clearStartupWidget();
      const icon = ctx.ui.theme.fg("dim", "○");
      const status = ctx.ui.theme.fg("dim", "Sandbox: off");
      ctx.ui.setStatus(SANDBOX_STATUS_KEY, `${icon} ${status}`);
    },
    unconfigured() {
      clearStartupWidget();
      const icon = ctx.ui.theme.fg("warning", "?");
      const status = ctx.ui.theme.fg("dim", "Sandbox: not configured");
      ctx.ui.setStatus(SANDBOX_STATUS_KEY, `${icon} ${status}`);
    },
    failed(message: string) {
      clearStartupWidget();
      const icon = ctx.ui.theme.fg("error", "✗");
      const status = ctx.ui.theme.fg("dim", "Sandbox: failed");
      ctx.ui.setStatus(SANDBOX_STATUS_KEY, `${icon} ${status}`);
      ctx.ui.notify(`Sandbox startup failed: ${message}`, "error");
    },
  };
}
