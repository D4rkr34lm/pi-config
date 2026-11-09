import { defineSandbox } from "../extensions/sandbox/service/defineSandbox";
import fs from "fs"
import path from "path";

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
  runAfterStart: ["bun i"],
  reuseSandboxById:  (cwd) => {
    const bunLockFileName = "bun.lock"
    const lockFilePath = path.join(cwd, bunLockFileName);
    if(!fs.existsSync(lockFilePath)) {
      throw new Error(`Lock file ${bunLockFileName} not found in ${cwd}. Cannot reuse sandbox.`);
    }

    const lockFileContent = fs.readFileSync(lockFilePath, "utf-8");
    const hash = require("crypto").createHash("sha256").update(lockFileContent).digest("hex");
    return hash;
  }
});
