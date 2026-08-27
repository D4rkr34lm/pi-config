import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { appRouter } from "./router";

const server = createHTTPServer({
  router: appRouter,
});

server.listen(3000);
