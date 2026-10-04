import { createReadTool } from "@earendil-works/pi-coding-agent";
import { Sandbox } from "../service/startSandbox";
import { mapHostPathToSandboxPath } from "./utils";
import { SANDBOX_WORKING_DIR } from "../service/constants";

export function buildSandboxedReadTool(sandbox: Sandbox) {
  const cwd = sandbox.workspacePath;

  const sandboxedReadTool = createReadTool(cwd, {
    operations: {
      access: async (absolutePath: string) => {
        const isFileProtected = sandbox.isPathProtected(absolutePath);

        const isFileOutsideOfWorkspace = !absolutePath.startsWith(cwd);

        if (isFileOutsideOfWorkspace) {
          throw new Error(
            `Access denied: ${absolutePath} is outside of the workspace.`
          );
        } else if (isFileProtected) {
          throw new Error(
            `Access denied: ${absolutePath} is a protected path.`
          );
        }
      },
      readFile: async (absolutePath: string) => {
        const sandboxPath = mapHostPathToSandboxPath({
          hostWorkingDir: cwd,
          sandboxWorkingDir: SANDBOX_WORKING_DIR,
          hostPath: absolutePath,
        });

        const fileContent = await sandbox.api.fileSystem.readFile.query({
          path: sandboxPath,
        });

        return Buffer.from(fileContent);
      },
    },
  });

  return sandboxedReadTool;
}
