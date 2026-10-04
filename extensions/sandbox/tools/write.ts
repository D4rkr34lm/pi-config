import { createWriteTool } from "@earendil-works/pi-coding-agent";
import { Sandbox } from "../service/startSandbox";
import { SANDBOX_WORKING_DIR } from "../service/constants";
import { mapHostPathToSandboxPath } from "./utils";

export function buildSandboxedWriteTool(sandbox: Sandbox) {
  const cwd = sandbox.workspacePath;
  const sandboxApi = sandbox.api;

  const sandboxedWriteTool = createWriteTool(cwd, {
    operations: {
      mkdir: async (path: string) => {
        if (sandbox.isPathProtected(path)) {
          throw new Error(`Access denied: ${path} is a protected path.`);
        } else if (!path.startsWith(cwd)) {
          throw new Error(
            `Access denied: ${path} is outside of the workspace.`
          );
        }

        await sandboxApi.fileSystem.mkdir.mutate({ path });
      },
      writeFile: async (absolutePath: string, content: string) => {
        const sandboxPath = mapHostPathToSandboxPath({
          hostWorkingDir: cwd,
          sandboxWorkingDir: SANDBOX_WORKING_DIR,
          hostPath: absolutePath,
        });

        await sandboxApi.fileSystem.writeFile.mutate({
          path: sandboxPath,
          content,
        });
      },
    },
  });

  return sandboxedWriteTool;
}
