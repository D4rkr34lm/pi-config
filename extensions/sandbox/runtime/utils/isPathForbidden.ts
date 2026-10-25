import { storage } from "../storage";
import { matchesGlob } from "path";

export function isPathForbidden(path: string): boolean {
  const { forbiddenGlobs } = storage;

  return forbiddenGlobs.some((glob) => matchesGlob(path, glob));
}
