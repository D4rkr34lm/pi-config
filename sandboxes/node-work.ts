import { defineSandbox } from "../extensions/sandbox/service/defineSandbox";

import fs from "fs"
import path from "path";

export default defineSandbox({
  name: "node-work",
  forbiddenPaths: ["**/*.env"],
  privatePaths: ["node_modules"],
  dependencies: {
    node: true,
    npm: true,
    tsx: true,
  },
  runAfterStart: ["npm run install-deps"],
  reuseSandboxById:  (cwd) => {
    const packageLockFileName = "package-lock-json"
    const lockFilePath = path.join(cwd, packageLockFileName);
    if(!fs.existsSync(lockFilePath)) {
      throw new Error(`Lock file ${packageLockFileName} not found in ${cwd}. Cannot reuse sandbox.`);
    }

    const lockFileContent = fs.readFileSync(lockFilePath, "utf-8");
    const hash = require("crypto").createHash("sha256").update(lockFileContent).digest("hex");
    return hash;
  }
});
