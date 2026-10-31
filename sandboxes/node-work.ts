import { defineSandbox } from "../extensions/sandbox/service/defineSandbox";

export default defineSandbox({
  name: "node-work",
  forbiddenPaths: ["auth.json"],
  privatePaths: ["node_modules"],
  dependencies: {
    node: true,
    npm: true,
    tsx: true,
  },
  runAfterStart: ["bun install"],
});
