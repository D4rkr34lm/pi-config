import { createEditTool } from "@earendil-works/pi-coding-agent";
import { Sandbox } from "../service/startSandbox";
import { mapHostPathToSandboxPath } from "./utils";
import { SANDBOX_WORKING_DIR } from "../service/constants";

export function buildSandboxedEditTool(sandbox: Sandbox) {
  const cwd = sandbox.workspacePath;
  const sandboxApi = sandbox.api;

  const sandboxedEditTool = createEditTool(cwd, {
    operations: {
      access: async (absolutePath: string) => {
        if (sandbox.isPathProtected(absolutePath)) {
          throw new Error(
            `Access denied: ${absolutePath} is a protected path.`
          );
        } else if (!absolutePath.startsWith(cwd)) {
          throw new Error(
            `Access denied: ${absolutePath} is outside of the workspace.`
          );
        }
      },
      readFile: async (absolutePath: string) => {
        const sandboxPath = mapHostPathToSandboxPath({
          hostWorkingDir: cwd,
          sandboxWorkingDir: SANDBOX_WORKING_DIR,
          hostPath: absolutePath,
        });

        const fileContent = await sandboxApi.fileSystem.readFile.query({
          path: sandboxPath,
        });

        return Buffer.from(fileContent);
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

  return sandboxedEditTool;
}
