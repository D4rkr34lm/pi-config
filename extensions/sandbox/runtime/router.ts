import { fileSystemRouter } from "./modules/fileSystem";
import { shellRouter } from "./modules/shell";
import { publicProcedure, router } from "./trpc";

const getHeartbeat = publicProcedure.query(() => ({
  isRunning: true,
}));

export const appRouter = router({
  fileSystem: fileSystemRouter,
  shell: shellRouter,
  getHeartbeat,
});

export type AppRouter = typeof appRouter;
