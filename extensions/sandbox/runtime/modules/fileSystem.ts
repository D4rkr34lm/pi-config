import z from "zod";
import fs from "fs/promises";
import { protectedProcedure, router } from "../trpc";
import { isPathForbidden } from "../utils/isPathForbidden";

const readFile = protectedProcedure
  .input(
    z.object({
      path: z.string(),
      encoding: z.enum(["utf8", "base64"]).optional(),
    })
  )
  .output(
    z.union([
      z.object({ type: z.literal("success"), content: z.string() }),
      z.object({ type: z.literal("error"), message: z.string() }),
    ])
  )
  .query(async ({ input }) => {
    if (isPathForbidden(input.path)) {
      return {
        type: "error",
        message: "ACCESS_DENIED",
      };
    }

    try {
      const stat = await fs.stat(input.path);

      if (!stat.isFile()) {
        return {
          type: "error",
          message: "NOT_A_FILE",
        };
      }
    } catch {
      return {
        type: "error",
        message: "FILE_NOT_FOUND",
      };
    }

    try {
      const content = await fs.readFile(input.path, input.encoding ?? "utf8");
      return {
        type: "success",
        content,
      };
    } catch {
      return {
        type: "error",
        message: "FAILED_TO_READ_FILE",
      };
    }
  });

const writeFile = protectedProcedure
  .input(z.object({ path: z.string(), content: z.string() }))
  .output(
    z.union([
      z.object({ type: z.literal("success") }),
      z.object({ type: z.literal("error"), message: z.string() }),
    ])
  )
  .mutation(async ({ input }) => {
    if (isPathForbidden(input.path)) {
      return {
        type: "error",
        message: "ACCESS_DENIED",
      };
    }

    try {
      await fs.writeFile(input.path, input.content, "utf-8");
    } catch {
      return {
        type: "error",
        message: "FAILED_TO_WRITE_FILE",
      };
    }

    return {
      type: "success",
    };
  });

const mkdir = protectedProcedure
  .input(z.object({ path: z.string() }))
  .output(
    z.union([
      z.object({ type: z.literal("success") }),
      z.object({ type: z.literal("error"), message: z.string() }),
    ])
  )
  .mutation(async ({ input }) => {
    if (isPathForbidden(input.path)) {
      return {
        type: "error",
        message: "ACCESS_DENIED",
      };
    }

    try {
      await fs.mkdir(input.path, { recursive: true });
    } catch {
      return {
        type: "error",
        message: "FAILED_TO_CREATE_DIRECTORY",
      };
    }

    return {
      type: "success",
    };
  });

export const fileSystemRouter = router({
  readFile,
  writeFile,
  mkdir,
});
