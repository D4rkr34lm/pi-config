import { defineSandbox } from "../extensions/sandbox/service/defineSandbox";
import fs from "fs"

export default defineSandbox({
  name: "node-latest",
  forbiddenPaths: ["auth.json"],
  privatePaths: ["node_modules"],
  dependencies: {
    node: true,
    npm: true,
    tsx: true,
  },
  runAfterStart: ["npm ci"],
});
