import { defineSandbox } from "../extensions/sandbox/builder/buildSandbox";
import {
  bash,
  curl,
  git,
  node,
  python,
  ripGrep,
} from "../extensions/sandbox/builder/dependencies";

export default defineSandbox({
  base: "debian:bookworm",
  name: "node",
  forbiddenPaths: ["**/*.env"],
  isolatedPaths: ["node_modules"],
  dependencies: [git(), bash(), curl(), ripGrep(), python(), node()],
  runAfterStart: ["npm install", "playwright install-deps"],
});
