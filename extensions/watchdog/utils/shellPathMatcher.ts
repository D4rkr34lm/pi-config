export type ExtractedFileMatch = {
  value: string;
  raw: string;
  kind: "path" | "glob" | "redirection-target" | "file-pattern-option";
  quoted: boolean;
  tokenIndex: number;
};

type ShellToken = {
  value: string;
  raw: string;
  quoted: boolean;
};

type ShellQuote = "'" | '"';

const COMMAND_SEPARATORS = new Set(["|", "||", "|&", "&", "&&", ";", ";;"]);

const SHELL_OPERATORS = new Set([...COMMAND_SEPARATORS, "(", ")"]);

const FILE_REDIR_OPERATORS = new Set([">", ">>", "<", "<>", ">|", "&>", "&>>"]);

const NON_FILE_REDIR_OPERATORS = new Set(["<<", "<<<", ">&", "<&"]);

const FILE_PATTERN_FLAGS = new Set([
  "--glob",
  "--iglob",
  "-g",
  "--include",
  "--exclude",
  "--include-dir",
  "--exclude-dir",
  "--ignore-file",
  "--files-from",
]);

const FIND_PATTERN_FLAGS = new Set([
  "-name",
  "-iname",
  "-path",
  "-ipath",
  "-wholename",
]);

const COMMANDS_ACCEPTING_PATH_ARGS = new Set([
  "bash",
  "bat",
  "bun",
  "cat",
  "cd",
  "chgrp",
  "chmod",
  "chown",
  "cmp",
  "cp",
  "dash",
  "deno",
  "diff",
  "file",
  "find",
  "gunzip",
  "gzip",
  "head",
  "ksh",
  "less",
  "ln",
  "mkdir",
  "more",
  "mv",
  "node",
  "patch",
  "perl",
  "php",
  "python",
  "python3",
  "rm",
  "rmdir",
  "ruby",
  "sh",
  "stat",
  "tail",
  "tar",
  "touch",
  "ts-node",
  "tsx",
  "unlink",
  "unzip",
  "wc",
  "zip",
  "zsh",
]);

/**
 * Heuristically attempts to extract file paths and globs from a shell command string.
 * This is a best-effort approach and may not be 100% accurate due to the complexity of shell syntax.
 * Aim is to minimize false positives while still capturing likely file paths and globs.
 */
export function extractFileMatchesFromShellCommand(
  command: string
): ExtractedFileMatch[] {
  const tokens = tokenizeShellLike(command);
  const results: ExtractedFileMatch[] = [];

  let currentCommand: string | undefined;
  let expectRedirectionTarget = false;
  let expectFilePatternFromFlag = false;
  let currentCommandIsFind = false;

  for (const [i, token] of tokens.entries()) {
    const { value } = token;

    if (!value) continue;

    if (COMMAND_SEPARATORS.has(value)) {
      currentCommand = undefined;
      currentCommandIsFind = false;
      expectRedirectionTarget = false;
      expectFilePatternFromFlag = false;
      continue;
    }

    if (SHELL_OPERATORS.has(value)) {
      continue;
    }

    if (NON_FILE_REDIR_OPERATORS.has(value)) {
      expectRedirectionTarget = false;
      continue;
    }

    if (FILE_REDIR_OPERATORS.has(value)) {
      expectRedirectionTarget = true;
      continue;
    }

    if (expectRedirectionTarget) {
      expectRedirectionTarget = false;

      if (isSafeRedirectionTarget(value)) {
        pushResult(results, token, i, "redirection-target", value);
      }

      continue;
    }

    if (!currentCommand && !looksLikeAssignment(value)) {
      currentCommand = basename(value);
      currentCommandIsFind = currentCommand === "find";
      continue;
    }

    const inlineFlagPattern = extractInlineFilePatternFlag(value);
    if (inlineFlagPattern) {
      pushResult(
        results,
        token,
        i,
        hasGlobMeta(inlineFlagPattern) ? "glob" : "file-pattern-option",
        inlineFlagPattern
      );
      continue;
    }

    if (
      FILE_PATTERN_FLAGS.has(value) ||
      (currentCommandIsFind && FIND_PATTERN_FLAGS.has(value))
    ) {
      expectFilePatternFromFlag = true;
      continue;
    }

    if (expectFilePatternFromFlag) {
      expectFilePatternFromFlag = false;

      if (isSafeFilePatternArgument(value)) {
        pushResult(
          results,
          token,
          i,
          hasGlobMeta(value) ? "glob" : "file-pattern-option",
          value
        );
      }

      continue;
    }

    if (looksLikeHighConfidencePathOrGlob(value, currentCommand)) {
      pushResult(
        results,
        token,
        i,
        hasGlobMeta(value) ? "glob" : "path",
        value
      );
    }
  }

  return dedupeResults(results);
}

function pushResult(
  results: ExtractedFileMatch[],
  token: ShellToken,
  tokenIndex: number,
  kind: ExtractedFileMatch["kind"],
  value: string
): void {
  results.push({
    value,
    raw: token.raw,
    kind,
    quoted: token.quoted,
    tokenIndex,
  });
}

function tokenizeShellLike(input: string): ShellToken[] {
  const tokens: ShellToken[] = [];

  let value = "";
  let raw = "";
  let quote: ShellQuote | undefined;
  let quoted = false;

  const push = () => {
    if (!raw) return;

    tokens.push({
      value,
      raw,
      quoted,
    });

    value = "";
    raw = "";
    quote = undefined;
    quoted = false;
  };

  for (let i = 0; i < input.length; i++) {
    const char = input.charAt(i);
    const next = input.charAt(i + 1);

    if (quote) {
      raw += char;

      if (char === quote) {
        quote = undefined;
        continue;
      }

      if (quote === '"' && char === "\\" && next) {
        raw += next;
        value += next;
        i++;
        continue;
      }

      value += char;
      continue;
    }

    if (/\s/.test(char)) {
      push();
      continue;
    }

    if (char === "'" || char === '"') {
      raw += char;
      quote = char;
      quoted = true;
      continue;
    }

    if (char === "\\" && next) {
      raw += char + next;
      value += next;
      i++;
      continue;
    }

    const op = readShellOperator(input, i);
    if (op) {
      push();
      tokens.push({
        value: op,
        raw: op,
        quoted: false,
      });
      i += op.length - 1;
      continue;
    }

    raw += char;
    value += char;
  }

  push();

  return tokens;
}

function readShellOperator(input: string, index: number): string | undefined {
  const three = input.slice(index, index + 3);
  const two = input.slice(index, index + 2);
  const one = input.charAt(index);

  if (three === "<<<" || three === "&>>") return three;

  if (
    two === "&&" ||
    two === "||" ||
    two === "|&" ||
    two === ";;" ||
    two === ">>" ||
    two === "<<" ||
    two === "<>" ||
    two === ">|" ||
    two === ">&" ||
    two === "<&" ||
    two === "&>"
  ) {
    return two;
  }

  if (one && "|&;()<>".includes(one)) return one;

  return undefined;
}

function looksLikeHighConfidencePathOrGlob(
  value: string,
  currentCommand?: string
): boolean {
  if (!isSafeCandidate(value)) return false;
  if (looksLikeUrlOrRemote(value)) return false;
  if (looksLikeAssignment(value)) return false;
  if (value.startsWith("-")) return false;

  if (isExplicitRelativeDirectory(value)) {
    return commandAcceptsPathArgs(currentCommand);
  }

  if (isAnchoredPath(value)) {
    return true;
  }

  const hasPathSeparator = value.includes("/") || value.includes("\\");

  if (!hasPathSeparator) {
    return isBareFileArgumentForCommand(value, currentCommand);
  }

  if (
    value.startsWith(".") &&
    !value.startsWith("./") &&
    !value.startsWith("../")
  ) {
    return false;
  }

  if (hasGlobMeta(value)) {
    return true;
  }

  if (/[\\/]$/.test(value)) {
    return true;
  }

  return finalPathSegmentLooksFileLike(value);
}

function isBareFileArgumentForCommand(
  value: string,
  currentCommand?: string
): boolean {
  if (!commandAcceptsPathArgs(currentCommand)) return false;

  return hasGlobMeta(value) || finalPathSegmentLooksFileLike(value);
}

function commandAcceptsPathArgs(currentCommand?: string): boolean {
  return !!currentCommand && COMMANDS_ACCEPTING_PATH_ARGS.has(currentCommand);
}

function isExplicitRelativeDirectory(value: string): boolean {
  return value === "." || value === "..";
}

function isAnchoredPath(value: string): boolean {
  return (
    value.startsWith("/") ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    value.startsWith("~/") ||
    /^~[^/\\]+[/\\]/.test(value) ||
    /^[A-Za-z]:[\\/]/.test(value) ||
    /^\\\\[^\\/]+[\\/][^\\/]+/.test(value)
  );
}

function isSafeCandidate(value: string): boolean {
  if (!value) return false;

  // Dynamic shell constructs are too ambiguous for a no-false-positive heuristic.
  if (
    value.includes("$") ||
    value.includes("`") ||
    value.includes("<(") ||
    value.includes(">(")
  ) {
    return false;
  }

  // Avoid obvious shell syntax fragments.
  if (/[;&|]/.test(value)) return false;

  return true;
}

function isSafeRedirectionTarget(value: string): boolean {
  if (!isSafeCandidate(value)) return false;

  // File descriptor redirection, not a file path.
  if (/^&?\d+$/.test(value)) return false;
  if (value === "-") return false;

  return true;
}

function isSafeFilePatternArgument(value: string): boolean {
  if (!isSafeCandidate(value)) return false;

  // For explicit pattern flags, bare globs are acceptable.
  if (hasGlobMeta(value)) return true;

  // Also allow anchored paths used as pattern/config files.
  return isAnchoredPath(value) || looksLikeHighConfidencePathOrGlob(value);
}

function extractInlineFilePatternFlag(value: string): string | undefined {
  const shortGlobPattern = value.startsWith("-g") ? value.slice(2) : "";
  if (shortGlobPattern && isSafeFilePatternArgument(shortGlobPattern)) {
    return shortGlobPattern;
  }

  const equalsIndex = value.indexOf("=");
  if (equalsIndex === -1) return undefined;

  const flag = value.slice(0, equalsIndex);
  const pattern = value.slice(equalsIndex + 1);

  if (!FILE_PATTERN_FLAGS.has(flag)) return undefined;
  if (!isSafeFilePatternArgument(pattern)) return undefined;

  return pattern;
}

function hasGlobMeta(value: string): boolean {
  return ["*", "?", "[", "]", "{", "}"].some((char) => value.includes(char));
}

function finalPathSegmentLooksFileLike(value: string): boolean {
  const normalized = value.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  const finalSegment = segments[segments.length - 1];

  if (!finalSegment) return false;

  return /^[^./][^/]*\.[A-Za-z0-9][A-Za-z0-9_-]{0,15}$/.test(finalSegment);
}

function looksLikeAssignment(value: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*=/.test(value);
}

function looksLikeUrlOrRemote(value: string): boolean {
  if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(value)) return true;

  // git@github.com:user/repo.git
  if (/^[^@\s]+@[^:\s]+:.+/.test(value)) return true;

  // host:/some/path
  if (/^[A-Za-z0-9_.-]+:\/.+/.test(value)) return true;

  return false;
}

function basename(value: string): string {
  const normalized = value.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);

  return segments[segments.length - 1] ?? value;
}

function dedupeResults(results: ExtractedFileMatch[]): ExtractedFileMatch[] {
  const seen = new Set<string>();

  return results.filter((result) => {
    const key = `${result.kind}:${result.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
