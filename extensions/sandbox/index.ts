import {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { SandboxService, useSandboxService } from "./service/sandboxService";
import { hasValue } from "../../utils/type-guards";
import { NONE_SANDBOX_NAME } from "./service/configs/sandboxesConfig";
import { createSandboxStartupUi } from "./ui/startupStatus";

async function selectSandboxDefinitionForWorkspace(
  sandboxService: SandboxService,
  pi: ExtensionAPI,
  ctx: ExtensionContext
) {
  const cwd = ctx.cwd;
  const sandboxUi = createSandboxStartupUi(ctx);

  if (!ctx.hasUI) {
    sandboxUi.unconfigured();
    return;
  }

  const availableDefinitions = sandboxService.getAvailableSandboxDefinitions();
  const selectedDefinition = await ctx.ui.select(
    "Select a sandbox definition to use for this project",
    [...availableDefinitions.map((def) => def.name), NONE_SANDBOX_NAME]
  );

  if (selectedDefinition === NONE_SANDBOX_NAME) {
    sandboxService.setSandboxDefinitionFor(cwd, null);
    sandboxUi.disabled();
  } else if (hasValue(selectedDefinition)) {
    sandboxService.setSandboxDefinitionFor(cwd, selectedDefinition);
    await runSandboxStartup(sandboxService, pi, ctx);
  } else {
    sandboxUi.unconfigured();
  }
}

async function runSandboxStartup(
  sandboxService: SandboxService,
  pi: ExtensionAPI,
  ctx: ExtensionContext
) {
  const cwd = ctx.cwd;
  const sandboxUi = createSandboxStartupUi(ctx);
  sandboxUi.start();

  try {
    const sandboxResult = await sandboxService.getSandboxFor(
      cwd,
      sandboxUi.update
    );

    if (sandboxResult.isOk()) {
      const sandbox = sandboxResult.value;
      if (hasValue(sandbox)) {
        sandboxUi.update({
          phase: "activating-tools",
          definitionName: sandbox.definition.name,
        });
        await sandboxService.connectToSandbox(sandbox, pi);
        sandboxUi.ready(sandbox.definition.name);
      } else {
        sandboxUi.disabled();
      }
    } else if (sandboxResult.error === "no-sandbox-configured") {
      sandboxUi.unconfigured();
      await selectSandboxDefinitionForWorkspace(sandboxService, pi, ctx);
    } else {
      sandboxUi.failed(sandboxResult.error);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sandboxUi.failed(message);
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

  pi.registerCommand("select-sandbox", {
    handler: async (_event, ctx) => {
      await selectSandboxDefinitionForWorkspace(sandboxService, pi, ctx);
    },
    description: "Select a sandbox definition for the current workspace",
  });
}
