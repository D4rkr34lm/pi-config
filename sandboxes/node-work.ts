import { defineSandbox } from "../extensions/sandbox/service/defineSandbox";

export default defineSandbox({
  name: "node-work",
  forbiddenPaths: ["**/*.env"],
  privatePaths: ["node_modules"],
  dependencies: {
    node: true,
    npm: true,
    tsx: true,
  },
  runAfterStart: ["npm ci"],
});
