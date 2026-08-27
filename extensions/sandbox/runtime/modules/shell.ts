import { execSync } from "child_process";
import { publicProcedure, router } from "../trpc";
import z from "zod";

const executeCommand = publicProcedure
  .input(z.object({ command: z.string() }))
  .mutation(async ({ input }) => {
    const { command } = input;
    return execSync(command, { encoding: "utf-8" });
  });

export const shellRouter = router({
  executeCommand,
});
