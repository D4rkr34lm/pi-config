import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { appRouter } from "./router";

const server = createHTTPServer({
  router: appRouter,
});

const PORT = process.env.PORT;

if (!PORT) {
  throw new Error("PORT environment variable is not set");
}

server.listen(Number(PORT));
