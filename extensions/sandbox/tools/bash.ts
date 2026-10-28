import { createBashTool } from "@earendil-works/pi-coding-agent";
import { Sandbox } from "../service/startSandbox";
import { SANDBOX_WORKING_DIR } from "../service/constants";
import { mapHostPathToSandboxPath } from "./utils";
import { pickBy } from "lodash-es";

export function buildSandboxedBashTool(sandbox: Sandbox) {
  const cwd = sandbox.workspacePath;
  const sandboxApi = sandbox.api;

  const sandboxedBashTool = createBashTool(cwd, {
    operations: {
      exec: async (command, commandCwd, { onData, env, signal, timeout }) => {
        const sandboxCwd = mapHostPathToSandboxPath({
          hostWorkingDir: cwd,
          sandboxWorkingDir: SANDBOX_WORKING_DIR,
          hostPath: commandCwd,
        });
        const sandboxEnvironment = pickBy(env, (_value, name) =>
          name.startsWith("PI_")
        );
        const commandOutputStream =
          await sandboxApi.shell.executeCommand.mutate(
            {
              authToken: sandbox.authToken,
              command,
              cwd: sandboxCwd,
              timeout,
              env: sandboxEnvironment,
            },
            { signal }
          );

        for await (const data of commandOutputStream) {
          if (data.type === "stdout" || data.type === "stderr") {
            onData(Buffer.from(data.data));
          } else {
            return { exitCode: data.code };
          }
        }

        return { exitCode: null };
      },
    },
  });

  return sandboxedBashTool;
}
