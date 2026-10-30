import { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { hasValue } from "../../../utils/type-guards";
import {
  loadSandboxesConfig,
  SandboxConfig,
} from "./config-loaders/loadSandboxConfig";
import { loadSandboxDefinitions } from "./config-loaders/loadSandboxDefinitions";
import { Sandbox, startSandbox } from "./startSandbox";
import { buildSandboxedReadTool } from "../tools/read";
import { buildSandboxedWriteTool } from "../tools/write";
import { buildSandboxedEditTool } from "../tools/edit";
import { buildSandboxedBashTool } from "../tools/bash";
import { SandboxDefinition } from "./defineSandbox";
import { ok, err, Result } from "neverthrow";

export interface SandboxServiceContext {
  sandboxConfig?: SandboxConfig;
  sandboxDefinitions?: Record<string, SandboxDefinition>;
}

export async function useSandboxService(context: SandboxServiceContext = {}) {
  const sandboxConfig = context.sandboxConfig ?? loadSandboxesConfig();
  const sandboxDefinitions =
    context.sandboxDefinitions ?? (await loadSandboxDefinitions());

  const activeSandboxes: { [cwd: string]: Sandbox } = {};

  async function getSandboxFor(
    cwd: string
  ): Promise<
    Result<Sandbox, "no-sandbox-configured" | "missing-sandbox-definition">
  > {
    const activeSandbox = activeSandboxes[cwd];

    if (hasValue(activeSandbox)) {
      return ok(activeSandbox);
    }

    const sandboxNameForCwd = sandboxConfig[cwd];

    if (!sandboxNameForCwd) {
      return err("no-sandbox-configured");
    }

    const sandboxDefinition = sandboxDefinitions[sandboxNameForCwd];

    if (!sandboxDefinition) {
      return err("missing-sandbox-definition");
    }

    const newSandbox = await startSandbox(sandboxDefinition, cwd);
    activeSandboxes[cwd] = newSandbox;
    return ok(newSandbox);
  }

  async function connectToSandbox(sandbox: Sandbox, pi: ExtensionAPI) {
    const readTool = buildSandboxedReadTool(sandbox);
    const writeTool = buildSandboxedWriteTool(sandbox);
    const editTool = buildSandboxedEditTool(sandbox);
    const bashTool = buildSandboxedBashTool(sandbox);

    pi.registerTool(readTool);
    pi.registerTool(writeTool);
    pi.registerTool(editTool);
    pi.registerTool(bashTool);
  }

  return {
    getSandboxFor,
    connectToSandbox,
  };
}
