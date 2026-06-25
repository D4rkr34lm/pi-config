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
  watchdog: {
    schema: Type.Object({
      workspaceBoundary: Type.Object({
        enforce: Type.Boolean({
          description:
            "If true, the watchdog will enforce workspace boundaries for all tools.",
        }),
        allowedFiles: Type.Array(
          Type.String({
            description:
              "A list of files globs that the watchdog will allow the agent to access.",
          })
        ),
      }),
      forbiddenFiles: Type.Array(
        Type.String({
          description:
            "A list of files globs that the watchdog will attempt to prevent the agent from accessing.",
        })
      ),
    }),
    default: () => ({
      workspaceBoundary: {
        enforce: true,
        allowedFiles: [],
      },
      forbiddenFiles: [".env", "auth.json"],
    }),
  },
} as const satisfies ExtensionSettingsSchemaMap;
