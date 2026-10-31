import { err, ok, Result } from "neverthrow";
import { SandboxDefinition } from "../defineSandbox";
import { loadSandboxesConfig, writeSandboxesConfig } from "./loadSandboxConfig";
import { loadSandboxDefinitions } from "./loadSandboxDefinitions";
import { hasNoValue } from "../../../../utils/type-guards";

const NONE_SANDBOX_NAME = "none";

export class SandboxesConfig {
  public readonly definitions: { [name: string]: SandboxDefinition };
  private sandboxesMap: Record<string, string>;

  public constructor(
    definitions: { [name: string]: SandboxDefinition },
    sandboxes: Record<string, string>
  ) {
    this.definitions = definitions;
    this.sandboxesMap = sandboxes;
  }

  public static async load() {
    const config = loadSandboxesConfig();
    const definitions = await loadSandboxDefinitions();
    return new SandboxesConfig(definitions, config);
  }

  getSandboxDefinitionFor(
    cwd: string
  ): Result<
    SandboxDefinition | null,
    "no-sandbox-configured" | "missing-sandbox-definition"
  > {
    const sandboxName = this.sandboxesMap[cwd];
    if (hasNoValue(sandboxName)) {
      return err("no-sandbox-configured");
    }
    if (sandboxName === NONE_SANDBOX_NAME) {
      return ok(null);
    }

    const selectedDefinition = this.definitions[sandboxName];
    if (hasNoValue(selectedDefinition)) {
      return err("missing-sandbox-definition");
    }
    return ok(selectedDefinition);
  }

  setSandboxDefinitionFor(cwd: string, definition: SandboxDefinition | null) {
    const sandboxName = definition?.name ?? NONE_SANDBOX_NAME;
    this.sandboxesMap[cwd] = sandboxName;

    writeSandboxesConfig(this.sandboxesMap);
  }
}
