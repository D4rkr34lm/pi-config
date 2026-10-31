import { defineSandbox } from "../extensions/sandbox/service/defineSandbox";

export default defineSandbox({
  name: "node-latest",
  forbiddenPaths: ["auth.json"],
});
