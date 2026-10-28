import { createEditTool } from "@earendil-works/pi-coding-agent";
import { Sandbox } from "../service/startSandbox";
import {
  ensureSandboxOperationSucceeded,
  mapHostPathToSandboxPath,
} from "./utils";
import { SANDBOX_WORKING_DIR } from "../service/constants";

export function buildSandboxedEditTool(sandbox: Sandbox) {
  const cwd = sandbox.workspacePath;
  const sandboxApi = sandbox.api;

  const sandboxedEditTool = createEditTool(cwd, {
    operations: {
      access: async (absolutePath: string) => {
        mapHostPathToSandboxPath({
          hostWorkingDir: cwd,
          sandboxWorkingDir: SANDBOX_WORKING_DIR,
          hostPath: absolutePath,
        });
      },
      readFile: async (absolutePath: string) => {
        const sandboxPath = mapHostPathToSandboxPath({
          hostWorkingDir: cwd,
          sandboxWorkingDir: SANDBOX_WORKING_DIR,
          hostPath: absolutePath,
        });

        const result = await sandboxApi.fileSystem.readFile.query({
          authToken: sandbox.authToken,
          path: sandboxPath,
        });

        ensureSandboxOperationSucceeded(result);
        return Buffer.from(result.content);
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

  return sandboxedEditTool;
}
