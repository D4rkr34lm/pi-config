import { TObject, Static } from "typebox";

export type ExtensionSettingDefinition<TSettingSchema extends TObject> = {
  schema: TSettingSchema;
  default: () => Static<TSettingSchema>;
};

export type ExtensionSettingsSchemaMap = Record<
  string,
  ExtensionSettingDefinition<TObject>
>;
