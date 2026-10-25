import { spawn } from "child_process";
import { protectedProcedure, router } from "../trpc";
import z from "zod";
import { toString } from "lodash-es";
import { SANDBOX_USER_ID } from "../constants";

const executeCommand = protectedProcedure
  .input(
    z.object({
      command: z.string(),
      timeout: z.number().optional(),
      env: z.record(z.string(), z.string().optional()).optional(),
    })
  )
  .mutation(async function* ({ input, signal }) {
    const { command, timeout, env } = input;

    if (signal?.aborted) {
      return;
    }

    const commandProcess = spawn(command, {
      shell: true,
      env: env,
      timeout,
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
