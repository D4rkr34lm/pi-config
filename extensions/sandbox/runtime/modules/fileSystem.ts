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
      console.log(
        "[ERROR] Attempted to read a file that is forbidden by the sandbox configuration:",
        input.path
      );

      return {
        type: "error",
        message: "ACCESS_DENIED",
      };
    }

    try {
      const stat = await fs.stat(input.path);

      if (!stat.isFile()) {
        console.log(
          "[ERROR] Attempted to read a path that is not a file:",
          input.path
        );

        return {
          type: "error",
          message: "NOT_A_FILE",
        };
      }
    } catch {
      console.log(
        "[ERROR] Attempted to read a file that does not exist:",
        input.path
      );

      return {
        type: "error",
        message: "FILE_NOT_FOUND",
      };
    }

    try {
      const content = await fs.readFile(input.path, input.encoding ?? "utf8");
      console.log("[INFO] Successfully read file:", input.path);
      return {
        type: "success",
        content,
      };
    } catch (e) {
      console.log(
        "[ERROR] Failed to read file due to an unexpected error:",
        input.path,
        e
      );
      return {
        type: "error" as const,
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
      console.log(
        "[ERROR] Attempted to write to a file that is forbidden by the sandbox configuration:",
        input.path
      );

      return {
        type: "error",
        message: "ACCESS_DENIED",
      };
    }

    try {
      await fs.writeFile(input.path, input.content, "utf-8");
    } catch (e) {
      console.log(
        "[ERROR] Failed to write to file due to an unexpected error:",
        input.path,
        e
      );

      return {
        type: "error" as const,
        message: "FAILED_TO_WRITE_FILE",
      };
    }

    console.log("[INFO] Successfully wrote to file:", input.path);

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
      console.log(
        "[ERROR] Attempted to create a directory that is forbidden by the sandbox configuration:",
        input.path
      );

      return {
        type: "error",
        message: "ACCESS_DENIED",
      };
    }

    try {
      await fs.mkdir(input.path, { recursive: true });
    } catch (e) {
      console.log(
        "[ERROR] Failed to create directory due to an unexpected error:",
        input.path,
        e
      );

      return {
        type: "error" as const,
        message: "FAILED_TO_CREATE_DIRECTORY",
      };
    }

    console.log("[INFO] Successfully created directory:", input.path);
    return {
      type: "success",
    };
  });

export const fileSystemRouter = router({
  readFile,
  writeFile,
  mkdir,
});
