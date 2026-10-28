import { createWriteTool } from "@earendil-works/pi-coding-agent";
import { Sandbox } from "../service/startSandbox";
import { SANDBOX_WORKING_DIR } from "../service/constants";
import {
  ensureSandboxOperationSucceeded,
  mapHostPathToSandboxPath,
} from "./utils";

export function buildSandboxedWriteTool(sandbox: Sandbox) {
  const cwd = sandbox.workspacePath;
  const sandboxApi = sandbox.api;

  const sandboxedWriteTool = createWriteTool(cwd, {
    operations: {
      mkdir: async (absolutePath: string) => {
        const sandboxPath = mapHostPathToSandboxPath({
          hostWorkingDir: cwd,
          sandboxWorkingDir: SANDBOX_WORKING_DIR,
          hostPath: absolutePath,
        });

        const result = await sandboxApi.fileSystem.mkdir.mutate({
          authToken: sandbox.authToken,
          path: sandboxPath,
        });

        ensureSandboxOperationSucceeded(result);
      },
      writeFile: async (absolutePath: string, content: string) => {
        const sandboxPath = mapHostPathToSandboxPath({
          hostWorkingDir: cwd,
          sandboxWorkingDir: SANDBOX_WORKING_DIR,
          hostPath: absolutePath,
        });

        const result = await sandboxApi.fileSystem.writeFile.mutate({
          authToken: sandbox.authToken,
          path: sandboxPath,
          content,
        });

        ensureSandboxOperationSucceeded(result);
      },
    },
  });

  return sandboxedWriteTool;
}
