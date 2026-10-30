import { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { useSandboxService } from "./service/sandboxService";

const SANDBOX_STATUS_KEY = "sandbox-status";

export default async function (pi: ExtensionAPI) {
  const sandboxService = await useSandboxService();

  let sandboxError: string | null = null;

  pi.on("session_start", async (_, ctx) => {
    const cwd = ctx.cwd;

    ctx.ui.setStatus(SANDBOX_STATUS_KEY, "Loading sandbox...");

    const sandboxResult = await sandboxService.getSandboxFor(cwd);

    if (sandboxResult.isOk()) {
      const sandbox = sandboxResult.value;
      await sandboxService.connectToSandbox(sandbox, pi);
      ctx.ui.setStatus(SANDBOX_STATUS_KEY, "Connected to sandbox");
    } else {
      sandboxError = sandboxResult.error;
      ctx.ui.setStatus(SANDBOX_STATUS_KEY, `Sandbox error: ${sandboxError}`);
    }
  });
}
