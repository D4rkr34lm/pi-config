import { defineSandbox } from "../extensions/sandbox/service/defineSandbox";
import {
  bash,
  curl,
  git,
  node,
  python,
  ripGrep,
} from "../extensions/sandbox/service/dependencies";

export default defineSandbox({
  base: "debian:bookworm",
  name: "node",
  forbiddenPaths: ["**/*.env"],
  isolatedPaths: ["node_modules"],
  dependencies: [git(), bash(), curl(), ripGrep(), python(), node()],
  runAfterStart: ["npm install", "playwright install-deps"],
});
