import {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { SandboxService, useSandboxService } from "./service/sandboxService";
import { hasValue } from "../../utils/type-guards";
import { NONE_SANDBOX_NAME } from "./service/configs/sandboxesConfig";

const SANDBOX_STATUS_KEY = "sandbox-status";

async function runSandboxStartup(
  sandboxService: SandboxService,
  pi: ExtensionAPI,
  ctx: ExtensionContext
) {
  const cwd = ctx.cwd;

  ctx.ui.setStatus(SANDBOX_STATUS_KEY, "Loading sandbox...");

  const sandboxResult = await sandboxService.getSandboxFor(cwd);

  if (sandboxResult.isOk()) {
    const sandbox = sandboxResult.value;
    if (hasValue(sandbox)) {
      await sandboxService.connectToSandbox(sandbox, pi);
      ctx.ui.setStatus(SANDBOX_STATUS_KEY, "Connected to sandbox");
    } else {
      ctx.ui.setStatus(SANDBOX_STATUS_KEY, "Running without sandbox");
    }
  } else if (sandboxResult.error === "no-sandbox-configured") {
    const availableDefinitions =
      sandboxService.getAvailableSandboxDefinitions();
    const selectedDefinition = await ctx.ui.select(
      "Select a sandbox definition to use for this project",
      [...availableDefinitions.map((def) => def.name), NONE_SANDBOX_NAME]
    );

    if (selectedDefinition === NONE_SANDBOX_NAME) {
      sandboxService.setSandboxDefinitionFor(cwd, null);
      ctx.ui.setStatus(SANDBOX_STATUS_KEY, "Running without sandbox");
    } else if (hasValue(selectedDefinition)) {
      sandboxService.setSandboxDefinitionFor(cwd, selectedDefinition);
      ctx.ui.setStatus(
        SANDBOX_STATUS_KEY,
        "Sandbox definition set - Loading sandbox..."
      );
      runSandboxStartup(sandboxService, pi, ctx);
    } else {
      ctx.ui.setStatus(
        SANDBOX_STATUS_KEY,
        "No sandbox definition selected - Running without sandbox"
      );
    }
  } else {
    ctx.ui.setStatus(
      SANDBOX_STATUS_KEY,
      `Error loading sandbox - ${sandboxResult.error} - ${cwd}`
    );
  }
}

export default async function (pi: ExtensionAPI) {
  const sandboxService = await useSandboxService();

  pi.on("session_start", async (_, ctx) => {
    await runSandboxStartup(sandboxService, pi, ctx);
  });

  pi.on("session_shutdown", async (event) => {
    if (event.reason === "quit" || event.reason === "reload") {
      await sandboxService.stopAllSandboxes();
    }
  });
}
