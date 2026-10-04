import fs from "fs";
import { SANDBOXES_DIR } from "./constants";
import path from "path";
import { SandboxDefinition } from "./defineSandbox";
import { keyBy } from "lodash-es";

export async function loadSandboxDefinitions() {
  const sandboxDefinitionFolder = fs.readdirSync(SANDBOXES_DIR, {
    withFileTypes: true,
  });

  const sandboxDefinitionFiles = sandboxDefinitionFolder.filter(
    (file) => file.isFile() && file.name.endsWith(".ts")
  );

  const sandboxDefinitions = await Promise.all(
    sandboxDefinitionFiles.map(async (file) => {
      const filePath = path.join(SANDBOXES_DIR, file.name);
      const sandboxDefinition = await import(filePath);
      return sandboxDefinition.default as SandboxDefinition;
    })
  );

  return keyBy(sandboxDefinitions, "name");
}
