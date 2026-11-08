import { Provider } from "../../types";
import { buildTsc6Provider } from "./v6";

const versionedMap: Record<
  number,
  (typescriptConfigPaths: string[]) => Provider
> = {
  6: buildTsc6Provider,
};

export function buildTscProvider(
  version: number,
  typescriptConfigPaths: string[]
) {
  const providerBuilder = versionedMap[version];
  if (!providerBuilder) {
    throw new Error(
      `Attempted to retrieve diagnostics provider for unsupported TypeScript version: ${version}`
    );
  }
  return providerBuilder(typescriptConfigPaths);
}
