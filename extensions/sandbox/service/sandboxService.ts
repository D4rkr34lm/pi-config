import { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { hasValue } from "../../../utils/type-guards";
import { getSandboxesConfig } from "./getSandboxConfig";
import { loadSandboxDefinitions } from "./loadSandboxDefenitions";
import { Sandbox, startSandbox } from "./startSandbox";
import { buildSandboxedReadTool } from "../tools/read";
import { buildSandboxedWriteTool } from "../tools/write";
import { buildSandboxedEditTool } from "../tools/edit";

export async function useSandboxService() {
  const sandboxConfig = getSandboxesConfig();
  const sandboxDefinitions = await loadSandboxDefinitions();

  const activeSandboxes: { [cwd: string]: Sandbox } = {};

  async function getSandboxFor(cwd: string): Promise<Sandbox> {
    const activeSandbox = activeSandboxes[cwd];

    if (hasValue(activeSandbox)) {
      return activeSandbox;
    }

    const sandboxNameForCwd = sandboxConfig[cwd];

    if (!sandboxNameForCwd) {
      throw new Error(`No sandbox configured for ${cwd}`);
    }

    const sandboxDefinition = sandboxDefinitions[sandboxNameForCwd];

    if (!sandboxDefinition) {
      throw new Error(`Sandbox definition not found for ${sandboxNameForCwd}`);
    }

    const newSandbox = await startSandbox(sandboxDefinition, cwd);
    activeSandboxes[cwd] = newSandbox;
    return newSandbox;
  }

  async function connectToSandboxFor(
    cwd: string,
    pi: ExtensionAPI
  ): Promise<void> {
    const sandbox = await getSandboxFor(cwd);

    const readTool = buildSandboxedReadTool(sandbox);
    const writeTool = buildSandboxedWriteTool(sandbox);
    const editTool = buildSandboxedEditTool(sandbox);

    pi.registerTool(readTool);
    pi.registerTool(writeTool);
    pi.registerTool(editTool);
  }

  return {
    getSandboxFor,
    connectToSandboxFor,
  };
}
