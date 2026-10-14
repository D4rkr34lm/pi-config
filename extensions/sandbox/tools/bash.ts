import { createBashTool } from "@earendil-works/pi-coding-agent";
import { Sandbox } from "../service/startSandbox";

export function buildSandboxedBashTool(sandbox: Sandbox) {
  const cwd = sandbox.workspacePath;
  const sandboxApi = sandbox.api;

  const sandboxedBashTool = createBashTool(cwd, {
    operations: {
      exec: async (command, cwd, { onData, env, signal, timeout }) => {
        const commandOutputStream =
          await sandboxApi.shell.executeCommand.mutate(
            {
              command,
              timeout,
              env,
            },
            { signal: signal }
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
