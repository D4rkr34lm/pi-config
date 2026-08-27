import z from "zod";
import fs from "fs/promises";
import { publicProcedure, router } from "../trpc";

const readFile = publicProcedure
  .input(z.object({ path: z.string() }))
  .query(async ({ input }) => {
    const content = await fs.readFile(input.path, "utf-8");
    return content;
  });

const writeFile = publicProcedure
  .input(z.object({ path: z.string(), content: z.string() }))
  .mutation(async ({ input }) => {
    await fs.writeFile(input.path, input.content, "utf-8");
    return { success: true };
  });

const OWNER_ONLY_ACCESS_BYTE = 0o700;
const denyAccess = publicProcedure
  .input(z.object({ glob: z.string() }))
  .mutation(async ({ input }) => {
    for await (const path of fs.glob(input.glob)) {
      await fs.chmod(path, OWNER_ONLY_ACCESS_BYTE);
    }
  });

export const fileSystemRouter = router({
  readFile,
  writeFile,
  denyAccess,
});
