import { createReadTool } from "@earendil-works/pi-coding-agent";
import { Sandbox } from "../service/startSandbox";
import {
  ensureSandboxOperationSucceeded,
  mapHostPathToSandboxPath,
} from "./utils";
import { SANDBOX_WORKING_DIR } from "../service/constants";
import path from "path";

const imageMimeTypesByExtension: Record<string, string> = {
  ".bmp": "image/bmp",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export function buildSandboxedReadTool(sandbox: Sandbox) {
  const cwd = sandbox.workspacePath;

  const sandboxedReadTool = createReadTool(cwd, {
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

        const result = await sandbox.api.fileSystem.readFile.query({
          authToken: sandbox.authToken,
          path: sandboxPath,
          encoding: "base64",
        });

        ensureSandboxOperationSucceeded(result);
        return Buffer.from(result.content, "base64");
      },
      detectImageMimeType: async (absolutePath: string) =>
        imageMimeTypesByExtension[path.extname(absolutePath).toLowerCase()],
    },
  });

  return sandboxedReadTool;
}
