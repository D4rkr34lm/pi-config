import { fileSystemRouter } from "./modules/fileSystem";
import { shellRouter } from "./modules/shell";
import { router } from "./trpc";

export const appRouter = router({
  fileSystem: fileSystemRouter,
  shell: shellRouter,
});

export type AppRouter = typeof appRouter;
