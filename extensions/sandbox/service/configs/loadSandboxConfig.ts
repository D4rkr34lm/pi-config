import z from "zod";
import { SANDBOXES_CONFIG_FILE } from "../constants";
import fs from "fs";

const sandboxConfigSchema = z.record(z.string(), z.string());
export type SandboxConfig = z.infer<typeof sandboxConfigSchema>;

export function loadSandboxesConfig(): SandboxConfig {
  if (!fs.existsSync(SANDBOXES_CONFIG_FILE)) {
    fs.writeFileSync(SANDBOXES_CONFIG_FILE, JSON.stringify({}), "utf-8");
  }

  const configContent = fs.readFileSync(SANDBOXES_CONFIG_FILE, "utf-8");
  const parseResult = sandboxConfigSchema.safeParse(JSON.parse(configContent));

  if (!parseResult.success) {
    throw new Error(`Invalid sandbox config: ${parseResult.error.message}`);
  } else {
    return parseResult.data;
  }
}

export function writeSandboxesConfig(config: SandboxConfig) {
  const configContent = JSON.stringify(config, null, 2);
  fs.writeFileSync(SANDBOXES_CONFIG_FILE, configContent, "utf-8");
}
