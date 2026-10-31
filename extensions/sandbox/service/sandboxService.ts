import { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { hasNoValue, hasValue } from "../../../utils/type-guards";
import { Sandbox, startSandbox } from "./startSandbox";
import { buildSandboxedReadTool } from "../tools/read";
import { buildSandboxedWriteTool } from "../tools/write";
import { buildSandboxedEditTool } from "../tools/edit";
import { buildSandboxedBashTool } from "../tools/bash";

import { ok, err, Result } from "neverthrow";
import { SandboxesConfig } from "./configs/sandboxesConfig";
import { keys, values } from "lodash-es";
import { SandboxDefinition } from "./defineSandbox";
import type { SandboxStartupProgressHandler } from "./sandboxStartupProgress";

export type SandboxService = Awaited<ReturnType<typeof useSandboxService>>;

export async function useSandboxService() {
  const config = await SandboxesConfig.load();

  const activeSandboxes: { [cwd: string]: Sandbox } = {};

  function getAvailableSandboxDefinitions(): SandboxDefinition[] {
    return values(config.definitions);
  }

  function setSandboxDefinitionFor(cwd: string, definitionName: string | null) {
    if (hasNoValue(definitionName)) {
      config.setSandboxDefinitionFor(cwd, null);
      return;
    } else {
      const definition = config.definitions[definitionName];

      if (hasValue(definition)) {
        config.setSandboxDefinitionFor(cwd, definition);
      } else {
        throw new Error(
          `Sandbox definition with name "${definitionName}" does not exist`
        );
      }
    }
  }

  async function getSandboxFor(
    cwd: string,
    onProgress?: SandboxStartupProgressHandler
  ): Promise<
    Result<
      Sandbox | null,
      "no-sandbox-configured" | "missing-sandbox-definition"
    >
  > {
    const activeSandbox = activeSandboxes[cwd];

    if (hasValue(activeSandbox)) {
      return ok(activeSandbox);
    }

    const sandboxDefinitionResult = config.getSandboxDefinitionFor(cwd);

    if (sandboxDefinitionResult.isErr()) {
      return err(sandboxDefinitionResult.error);
    }

    const sandboxDefinition = sandboxDefinitionResult.value;

    if (hasNoValue(sandboxDefinition)) {
      return ok(null);
    } else {
      const newSandbox = await startSandbox(sandboxDefinition, cwd, onProgress);
      activeSandboxes[cwd] = newSandbox;
      return ok(newSandbox);
    }
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

  async function stopSandboxFor(cwd: string) {
    const activeSandbox = activeSandboxes[cwd];

    if (hasValue(activeSandbox)) {
      await activeSandbox.stop();
      delete activeSandboxes[cwd];
    }
  }

  async function stopAllSandboxes() {
    for (const cwd of keys(activeSandboxes)) {
      await stopSandboxFor(cwd);
    }
  }

  return {
    getSandboxFor,
    connectToSandbox,
    getAvailableSandboxDefinitions,
    setSandboxDefinitionFor,
    stopSandboxFor,
    stopAllSandboxes,
  };
}
