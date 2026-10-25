import z from "zod";
import { protectedProcedure, publicProcedure, router } from "../trpc";
import { storage } from "../storage";

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

    storage.forbiddenGlobs = forbiddenGlobs;
    storage.isSetup = true;

    return {
      success: true,
    };
  });

export const adminRouter = router({
  isAvailable,
  setup,
});
