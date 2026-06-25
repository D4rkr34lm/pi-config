import Type from "typebox";
import { homedir } from "node:os";
import path from "node:path";
import { ExtensionSettingsSchemaMap } from "./types";

export const extensionSettingsFilePath = path.join(
  homedir(),
  ".pi",
  "agent",
  "extension-settings.json"
);

export const extensionSettingDefinitions = {
  analytics: {
    schema: Type.Object({
      enabled: Type.Boolean(),
    }),
    default: () => ({
      enabled: true,
    }),
  },
} as const satisfies ExtensionSettingsSchemaMap;
