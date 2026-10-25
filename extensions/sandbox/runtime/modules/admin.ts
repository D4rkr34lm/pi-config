import z from "zod";
import { protectedProcedure, publicProcedure, router } from "../trpc";
import { setupStorage } from "../storage";
import { denyAccessToGlob } from "../utils/denyAccessToGlob";

const isAvailable = publicProcedure.query(() => ({
  isAvailable: true,
}));

const setup = protectedProcedure
  .input(
    z.object({
      forbiddenGlobs: z.array(z.string()),
    })
  )
  .mutation(async ({ input }) => {
    const { forbiddenGlobs } = input;

    const denyPromises = forbiddenGlobs.map((glob) => {
      return denyAccessToGlob(glob);
    });

    await Promise.allSettled(denyPromises);

    setupStorage({ forbiddenGlobs });

    return {
      success: true,
    };
  });

export const adminRouter = router({
  isAvailable,
  setup,
});
