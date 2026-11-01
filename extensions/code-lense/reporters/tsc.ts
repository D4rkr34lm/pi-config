import type { IssueReporter } from "../types";

const ANSI_ESCAPE_PATTERN = new RegExp(
  `${String.fromCodePoint(27)}\\[[0-?]*[ -/]*[@-~]`,
  "g"
);

const diagnosticPatterns = [
  /^(?<path>.+)\((?<line>\d+),(?<column>\d+)\):\s+(?:error|warning|message|suggestion)\s+(?<code>TS\d+):\s*(?<message>.*)$/,
  /^(?<path>.+):(?<line>\d+):(?<column>\d+)\s+-\s+(?:error|warning|message|suggestion)\s+(?<code>TS\d+):\s*(?<message>.*)$/,
];

type DiagnosticHeader = {
  path: string;
  line: number;
  column: number;
  code: string;
  message: string;
};

function parseDiagnosticHeader(line: string): DiagnosticHeader | undefined {
  const groups = diagnosticPatterns
    .map((pattern) => line.match(pattern)?.groups)
    .find((matchGroups) => matchGroups !== undefined);

  if (
    !groups?.path ||
    !groups.line ||
    !groups.column ||
    !groups.code ||
    groups.message === undefined
  ) {
    return undefined;
  }

  return {
    path: groups.path,
    line: Number(groups.line),
    column: Number(groups.column),
    code: groups.code,
    message: groups.message.trim(),
  };
}

function diagnosticContinuation(
  lines: string[],
  headerIndex: number
): string[] {
  const candidates = lines.slice(headerIndex + 1);
  const endIndex = candidates.findIndex(
    (line) =>
      line.trim() === "" ||
      parseDiagnosticHeader(line) !== undefined ||
      !/^\s/.test(line)
  );

  return candidates
    .slice(0, endIndex === -1 ? candidates.length : endIndex)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export const tscReporter: IssueReporter = {
  id: "tsc",
  formatOutput: (commandOutput: string) => {
    const lines = commandOutput.replace(ANSI_ESCAPE_PATTERN, "").split(/\r?\n/);

    return lines.flatMap((line, index) => {
      const diagnostic = parseDiagnosticHeader(line);

      if (!diagnostic) {
        return [];
      }

      const message = [
        diagnostic.message,
        ...diagnosticContinuation(lines, index),
      ]
        .filter((part) => part.length > 0)
        .join(" ");

      return [
        {
          type: "type" as const,
          position: {
            path: diagnostic.path,
            line: diagnostic.line,
            column: diagnostic.column,
          },
          message: `${diagnostic.code}${message ? `: ${message}` : ""}`,
        },
      ];
    });
  },
};
