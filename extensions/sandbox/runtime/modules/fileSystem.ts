import z from "zod";
import fs from "fs/promises";
import path from "path";
import { protectedProcedure, router } from "../trpc";
import { SANDBOX_GROUP_ID, SANDBOX_USER_ID } from "../constants";
import { isPathForbidden } from "../utils/isPathForbidden";

// TODO: fix files being owned by sandbox and not host user when created
const SANDBOX_FILE_MODE = 0o644;
const SANDBOX_DIRECTORY_MODE = 0o755;

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.lstat(targetPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

async function makePathOwnedBySandbox(
  targetPath: string,
  mode: number
): Promise<void> {
  await fs.chown(targetPath, SANDBOX_USER_ID, SANDBOX_GROUP_ID);
  await fs.chmod(targetPath, mode);
}

function createdDirectoryPaths(
  firstCreatedPath: string,
  targetPath: string
): string[] {
  return path
    .relative(firstCreatedPath, targetPath)
    .split(path.sep)
    .filter(Boolean)
    .reduce(
      (createdPaths, part) => [
        ...createdPaths,
        path.join(createdPaths.at(-1) ?? firstCreatedPath, part),
      ],
      [firstCreatedPath]
    );
}

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
      const existedBeforeWrite = await pathExists(input.path);
      await fs.writeFile(input.path, input.content, {
        encoding: "utf-8",
        mode: SANDBOX_FILE_MODE,
      });

      if (!existedBeforeWrite) {
        await makePathOwnedBySandbox(input.path, SANDBOX_FILE_MODE);
      }
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
      const firstCreatedPath = await fs.mkdir(input.path, { recursive: true });

      if (firstCreatedPath !== undefined) {
        await Promise.all(
          createdDirectoryPaths(firstCreatedPath, input.path).map(
            (createdPath) =>
              makePathOwnedBySandbox(createdPath, SANDBOX_DIRECTORY_MODE)
          )
        );
      }
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
