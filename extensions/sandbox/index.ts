import { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { useSandboxService } from "./service/sandboxService";

export default async function (pi: ExtensionAPI) {
  const sandboxService = await useSandboxService();

  pi.on("before_agent_start", async (_, ctx) => {
    const cwd = ctx.cwd;

    await sandboxService.connectToSandboxFor(cwd, pi);
  });
}
