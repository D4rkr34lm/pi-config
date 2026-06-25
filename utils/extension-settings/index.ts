import { has } from "lodash-es";
import {
  extensionSettingDefinitions,
  extensionSettingsFilePath,
} from "./definition";
import { Parse } from "typebox/schema";
import { Static } from "typebox/type";
import { mkdir, readFile, rename, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import Type from "typebox";

export type ExtensionId = keyof typeof extensionSettingDefinitions;
type ExtensionSettingSchema<TExtensionId extends ExtensionId> =
  (typeof extensionSettingDefinitions)[TExtensionId]["schema"];
export type ExtensionSettings<TExtensionId extends ExtensionId> = Static<
  ExtensionSettingSchema<TExtensionId>
>;
type ExtensionSettingsFile = Partial<{
  [TExtensionId in ExtensionId]: ExtensionSettings<TExtensionId>;
}>;

const rawExtensionSettingsFileSchema = Type.Record(
  Type.String(),
  Type.Unknown()
);
type RawExtensionSettingsFile = Static<typeof rawExtensionSettingsFileSchema>;

function parseExtensionSettings<TExtensionId extends ExtensionId>(
  extensionId: TExtensionId,
  value: unknown
): ExtensionSettings<TExtensionId> {
  return Parse(
    extensionSettingDefinitions[extensionId].schema,
    value
  ) as ExtensionSettings<TExtensionId>;
}

async function writeSettingsFile(
  settings: ExtensionSettingsFile
): Promise<void> {
  await mkdir(path.dirname(extensionSettingsFilePath), { recursive: true });

  const tmpPath = `${extensionSettingsFilePath}.tmp`;
  await writeFile(tmpPath, JSON.stringify(settings, null, 2));
  await rename(tmpPath, extensionSettingsFilePath);
}

async function readSettingsFile(): Promise<RawExtensionSettingsFile> {
  if (!existsSync(extensionSettingsFilePath)) {
    return {};
  }

  try {
    const settingsFileContent = await readFile(
      extensionSettingsFilePath,
      "utf-8"
    );
    return Parse(
      rawExtensionSettingsFileSchema,
      JSON.parse(settingsFileContent)
    );
  } catch {
    return {};
  }
}

export async function getExtensionSettings<TExtensionId extends ExtensionId>(
  extensionId: TExtensionId
): Promise<ExtensionSettings<TExtensionId>> {
  const settings = await readSettingsFile();
  const settingDefinition = extensionSettingDefinitions[extensionId];
  const hasExtensionSettings = has(settings, extensionId);

  if (hasExtensionSettings) {
    try {
      return parseExtensionSettings(extensionId, settings[extensionId]);
    } catch {
      // Fall through and replace only this extension's invalid settings.
    }
  }

  const parsedDefaultSettings = parseExtensionSettings(
    extensionId,
    settingDefinition.default()
  );
  await writeSettingsFile({
    ...settings,
    [extensionId]: parsedDefaultSettings,
  });

  return parsedDefaultSettings;
}
