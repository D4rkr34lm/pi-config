import { initTRPC, TRPCError } from "@trpc/server";
import { storage } from "./storage";
import z from "zod";
/**
 * Initialization of tRPC backend
 * Should be done only once per backend!
 */
const t = initTRPC.create();
/**
 * Export reusable router and procedure helpers
 * that can be used throughout the router
 */
export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure
  .input(z.object({ authToken: z.string() }))
  .use(({ input, next }) => {
    if (input.authToken !== storage.authToken) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
      });
    }
    return next();
  });
