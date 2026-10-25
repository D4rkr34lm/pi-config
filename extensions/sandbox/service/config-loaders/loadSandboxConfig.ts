import z from "zod";
import { SANDBOXES_CONFIG_FILE } from "../constants";
import fs from "fs";

const sandboxConfigSchema = z.record(z.string(), z.string());
export type SandboxConfig = z.infer<typeof sandboxConfigSchema>;

export function loadSandboxesConfig(): SandboxConfig {
  if (!fs.existsSync(SANDBOXES_CONFIG_FILE)) {
    throw new Error(`TODO: implement`);
  }

  const configContent = fs.readFileSync(SANDBOXES_CONFIG_FILE, "utf-8");
  const parseResult = sandboxConfigSchema.safeParse(JSON.parse(configContent));

  if (!parseResult.success) {
    throw new Error(`Invalid sandbox config: ${parseResult.error.message}`);
  } else {
    return parseResult.data;
  }
}
