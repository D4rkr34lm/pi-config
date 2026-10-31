import {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { useSandboxService } from "./service/sandboxService";
import { hasValue } from "../../utils/type-guards";

const SANDBOX_STATUS_KEY = "sandbox-status";

async function runSandboxStartup(pi: ExtensionAPI, ctx: ExtensionContext) {
  const sandboxService = await useSandboxService();

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
      availableDefinitions.map((def) => def.name)
    );

    if (hasValue(selectedDefinition)) {
      sandboxService.setSandboxDefinitionFor(cwd, selectedDefinition);
      ctx.ui.setStatus(
        SANDBOX_STATUS_KEY,
        "Sandbox definition set - Loading sandbox..."
      );
      runSandboxStartup(pi, ctx);
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
    await runSandboxStartup(pi, ctx);
  });
}
