import { fileSystemRouter } from "./fileSystem";
import { shellRouter } from "./shell";
import { router } from "./trpc";

export const appRouter = router({
  fileSystem: fileSystemRouter,
  shell: shellRouter,
});

export type AppRouter = typeof appRouter;
