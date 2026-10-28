import { spawn } from "child_process";
import { protectedProcedure, router } from "../trpc";
import z from "zod";
import { omit, toString } from "lodash-es";
import { SANDBOX_USER_ID } from "../constants";

const commandEnvironment = omit(process.env, "SANDBOX_AUTH_TOKEN");

const executeCommand = protectedProcedure
  .input(
    z.object({
      command: z.string(),
      cwd: z.string().optional(),
      timeout: z.number().optional(),
      env: z.record(z.string(), z.string().optional()).optional(),
    })
  )
  .mutation(async function* ({ input, signal }) {
    const { command, cwd, timeout, env } = input;

    if (signal?.aborted) {
      return;
    }

    const commandProcess = spawn(command, {
      shell: true,
      cwd,
      env: { ...commandEnvironment, ...env },
      timeout: timeout === undefined ? undefined : timeout * 1000,
      uid: SANDBOX_USER_ID,
    });

    const onAbort = () => {
      commandProcess.kill();
    };

    signal?.addEventListener("abort", onAbort, { once: true });

    for await (const data of commandProcess.stdout) {
      yield { type: "stdout" as const, data: toString(data) };
    }

    for await (const data of commandProcess.stderr) {
      yield { type: "stderr" as const, data: toString(data) };
    }

    const exitCode = await new Promise<number | null>((resolve) => {
      commandProcess.on("exit", (code) => {
        resolve(code);
      });
    });

    yield { type: "exit" as const, code: exitCode };
  });

export const shellRouter = router({
  executeCommand,
});
