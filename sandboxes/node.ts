import { defineSandbox } from "../extensions/sandbox/service/defineSandbox";

export default defineSandbox({
  name: "node-latest",
  forbiddenPaths: ["auth.json"],
  privatePaths: ["node_modules"],
  dependencies: {
    node: true,
    npm: true,
    tsx: true,
    bun: "1.4.4",
  },
  runAfterStart: ["bun install"],
});
