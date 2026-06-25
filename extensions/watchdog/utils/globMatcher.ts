export function globMatches(candidate: string, pattern: string): boolean {
  const flags = process.platform === "win32" ? "iu" : "u";
  return new RegExp(`^${globToRegExpSource(pattern)}$`, flags).test(candidate);
}

function globToRegExpSource(pattern: string): string {
  let source = "";

  for (let i = 0; i < pattern.length; i++) {
    const char = pattern.charAt(i);
    const next = pattern.charAt(i + 1);

    if (char === "*" && next === "*") {
      source += ".*";
      i++;
      continue;
    }

    if (char === "*") {
      source += "[^/]*";
      continue;
    }

    if (char === "?") {
      source += "[^/]";
      continue;
    }

    source += escapeRegExp(char);
  }

  return source;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
