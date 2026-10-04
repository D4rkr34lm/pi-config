import { createBashTool } from "@earendil-works/pi-coding-agent";
import { Sandbox } from "../service/startSandbox";

export function buildSandboxedBashTool(sandbox: Sandbox) {
  const cwd = sandbox.workspacePath;
  const sandboxApi = sandbox.api;

  const sandboxedBashTool = createBashTool(cwd, {
    operations: {
      exec: async (command, cwd, options) => {},
    },
  });
}
