import { spawn } from "child_process";
import { once } from "events";
import { PassThrough, Readable } from "stream";
import { finished } from "stream/promises";
import { protectedProcedure, router } from "../trpc";
import z from "zod";
import { omit, toString } from "lodash-es";
import { SANDBOX_USER_ID } from "../constants";

const commandEnvironment = omit(process.env, "SANDBOX_AUTH_TOKEN");

type CommandOutput =
  | { type: "stdout"; data: string }
  | { type: "stderr"; data: string };

async function* tagCommandOutput(
  stream: Readable,
  type: CommandOutput["type"]
): AsyncGenerator<CommandOutput> {
  for await (const data of stream) {
    yield { type, data: toString(data) };
  }
}

function mergeCommandOutput(
  stdout: Readable,
  stderr: Readable
): AsyncIterable<CommandOutput> {
  const output = new PassThrough({ objectMode: true });
  const taggedStreams = [
    Readable.from(tagCommandOutput(stdout, "stdout")),
    Readable.from(tagCommandOutput(stderr, "stderr")),
  ];

  const streamsFinished = Promise.all(
    taggedStreams.map((stream) => {
      stream.pipe(output, { end: false });
      return finished(stream);
    })
  );

  void streamsFinished.then(
    () => output.end(),
    (error) => output.destroy(error)
  );

  return output;
}

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

    const processCompletion = once(commandProcess, "close").then(
      ([exitCode]) => ({ exitCode: exitCode as number | null }),
      (error: unknown) => ({ error })
    );
    const onAbort = () => {
      console.log("[INFO] Aborting command execution due to signal abort");
      commandProcess.kill();
    };

    if (signal?.aborted) {
      onAbort();
    } else {
      signal?.addEventListener("abort", onAbort, { once: true });
    }

    try {
      for await (const output of mergeCommandOutput(
        commandProcess.stdout,
        commandProcess.stderr
      )) {
        yield output;
      }

      const completion = await processCompletion;
      if ("error" in completion) {
        throw completion.error;
      }

      console.log(
        "[INFO] Command execution completed with exit code:",
        completion.exitCode
      );

      yield { type: "exit" as const, code: completion.exitCode };
    } finally {
      signal?.removeEventListener("abort", onAbort);
    }
  });

export const shellRouter = router({
  executeCommand,
});
