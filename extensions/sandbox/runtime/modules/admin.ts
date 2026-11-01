import fs from "fs/promises";
import z from "zod";
import { protectedProcedure, publicProcedure, router } from "../trpc";
import { setupStorage } from "../storage";
import { denyAccessToGlob } from "../utils/denyAccessToGlob";
import { SANDBOX_GROUP_ID, SANDBOX_USER_ID } from "../constants";

const isAvailable = publicProcedure.query(() => ({
  isAvailable: true,
}));

const setup = protectedProcedure
  .input(
    z.object({
      forbiddenGlobs: z.array(z.string()),
      writablePaths: z.array(z.string()),
    })
  )
  .mutation(async ({ input }) => {
    const { forbiddenGlobs, writablePaths } = input;

    await Promise.all(
      writablePaths.map((path) =>
        fs.chown(path, SANDBOX_USER_ID, SANDBOX_GROUP_ID)
      )
    );

    const denyPromises = forbiddenGlobs.map((glob) => {
      return denyAccessToGlob(glob);
    });

    await Promise.allSettled(denyPromises);

    console.log(
      "[INFO] Setting up sandbox storage with forbidden globs:",
      forbiddenGlobs
    );

    setupStorage({ forbiddenGlobs });

    console.log("[INFO] Sandbox storage setup complete.");

    return {
      success: true,
    };
  });

export const adminRouter = router({
  isAvailable,
  setup,
});
