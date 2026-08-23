import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { appRouter } from "./index";

const server = createHTTPServer({
  router: appRouter,
});

server.listen(3000);
