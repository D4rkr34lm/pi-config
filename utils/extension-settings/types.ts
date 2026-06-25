import { TSchema, Static } from "typebox";

export type ExtensionSettingDefinition<TSettingSchema extends TSchema> = {
  schema: TSettingSchema;
  default: () => Static<TSettingSchema>;
};

export type ExtensionSettingsSchemaMap = Record<
  string,
  ExtensionSettingDefinition<TSchema>
>;
