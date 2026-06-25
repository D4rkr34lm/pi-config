import path from "node:path";
import { globMatches } from "./globMatcher";
import {
  expandShellPath,
  hasPathSeparator,
  isAbsoluteLikePath,
  isInsidePath,
  normalizeForComparison,
  normalizePathSeparators,
} from "./pathUtils";

export function matchesAnyPattern(
  absolutePath: string,
  workspacePath: string,
  patterns: string[] | undefined
): boolean {
  return (
    patterns?.some((pattern) =>
      matchesPathPattern(absolutePath, workspacePath, pattern)
    ) ?? false
  );
}

function matchesPathPattern(
  absolutePath: string,
  workspacePath: string,
  pattern: string
): boolean {
  const normalizedPattern = normalizePattern(pattern, workspacePath);
  if (!normalizedPattern) return false;

  const absoluteCandidate = normalizeForComparison(absolutePath);
  const basenameCandidate = path.basename(absolutePath);
  const relativeCandidate = isInsidePath(absolutePath, workspacePath)
    ? normalizePathSeparators(
        path.relative(path.resolve(workspacePath), path.resolve(absolutePath))
      )
    : undefined;

  if (isAbsoluteLikePath(pattern)) {
    return globMatches(absoluteCandidate, normalizedPattern);
  }

  if (hasPathSeparator(pattern)) {
    return (
      (relativeCandidate !== undefined &&
        globMatches(relativeCandidate, normalizedPattern)) ||
      globMatches(absoluteCandidate, normalizedPattern)
    );
  }

  return (
    globMatches(basenameCandidate, normalizedPattern) ||
    (relativeCandidate !== undefined &&
      globMatches(relativeCandidate, normalizedPattern))
  );
}

function normalizePattern(
  pattern: string,
  workspacePath: string
): string | undefined {
  const trimmedPattern = pattern.trim();
  if (!trimmedPattern) return undefined;

  if (isAbsoluteLikePath(trimmedPattern)) {
    return normalizeForComparison(
      path.resolve(expandShellPath(trimmedPattern))
    );
  }

  if (
    trimmedPattern.startsWith("~/") ||
    trimmedPattern.startsWith("~\\") ||
    trimmedPattern === "~"
  ) {
    return normalizeForComparison(
      path.resolve(expandShellPath(trimmedPattern))
    );
  }

  if (trimmedPattern.startsWith("./") || trimmedPattern.startsWith(".\\")) {
    return normalizePathSeparators(trimmedPattern.slice(2));
  }

  if (trimmedPattern.startsWith("../") || trimmedPattern.startsWith("..\\")) {
    return normalizeForComparison(path.resolve(workspacePath, trimmedPattern));
  }

  return normalizePathSeparators(trimmedPattern);
}
