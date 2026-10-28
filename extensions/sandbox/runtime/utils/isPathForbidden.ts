import { storage } from "../storage";
import nodePath, { matchesGlob } from "path";
import { some } from "lodash-es";

export function isPathForbidden(path: string): boolean {
  const absolutePath = nodePath.resolve(path);

  return some(
    storage.forbiddenGlobs,
    (glob) =>
      matchesGlob(path, glob) ||
      matchesGlob(absolutePath, nodePath.resolve(glob))
  );
}
