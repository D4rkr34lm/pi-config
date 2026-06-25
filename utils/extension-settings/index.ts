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
import { err, ok, Result } from "neverthrow";

export type ExtensionId = keyof typeof extensionSettingDefinitions;
type ExtensionSettingSchema<TExtensionId extends ExtensionId> =
  (typeof extensionSettingDefinitions)[TExtensionId]["schema"];
export type ExtensionSettings<TExtensionId extends ExtensionId> = Static<
  ExtensionSettingSchema<TExtensionId>
>;

const rawExtensionSettingsFileSchema = Type.Record(
  Type.String(),
  Type.Unknown()
);
type RawExtensionSettingsFile = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseExtensionSettings<TExtensionId extends ExtensionId>(
  extensionId: TExtensionId,
  value: unknown
): Result<ExtensionSettings<TExtensionId>, "invalid"> {
  try {
    const parsedSchema = Parse(
      extensionSettingDefinitions[extensionId].schema,
      value
    ) as ExtensionSettings<TExtensionId>;

    return ok(parsedSchema);
  } catch {
    return err("invalid");
  }
}

async function writeSettingsFile(
  settings: RawExtensionSettingsFile
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
    ) as RawExtensionSettingsFile;
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
    const parsedSettingsResult = parseExtensionSettings(
      extensionId,
      settings[extensionId]
    );

    if (parsedSettingsResult.isOk()) {
      return parsedSettingsResult.value;
    }

    const existingSettings = settings[extensionId];
    const defaultSettings = settingDefinition.default();
    const mergedSettings = isRecord(existingSettings)
      ? {
          ...defaultSettings,
          ...existingSettings,
        }
      : defaultSettings;

    const parsedMergedSettingsResult = parseExtensionSettings(
      extensionId,
      mergedSettings
    );

    if (parsedMergedSettingsResult.isOk()) {
      await writeSettingsFile({
        ...settings,
        [extensionId]: parsedMergedSettingsResult.value,
      });

      return parsedMergedSettingsResult.value;
    } else {
      return settingDefinition.default() as ExtensionSettings<TExtensionId>;
    }
  } else {
    const defaultSettings = settingDefinition.default();
    await writeSettingsFile({
      ...settings,
      [extensionId]: defaultSettings,
    });

    return defaultSettings as ExtensionSettings<TExtensionId>;
  }
}
