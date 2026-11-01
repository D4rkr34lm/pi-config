import { describe, expect, it } from "vitest";
import { tscReporter } from "./tsc";

describe("tscReporter", () => {
  it("formats standard tsc diagnostics and their message continuations", () => {
    const output = [
      "src/example.ts(12,7): error TS2322: Type 'string' is not assignable to type 'number'.",
      "  Type 'string' is not assignable to type 'never'.",
      "src/other.ts(3,1): error TS6133: 'unused' is declared but its value is never read.",
      "",
      "Found 2 errors in 2 files.",
    ].join("\n");

    expect(tscReporter.formatOutput(output)).toEqual([
      {
        type: "type",
        position: { path: "src/example.ts", line: 12, column: 7 },
        message:
          "TS2322: Type 'string' is not assignable to type 'number'. Type 'string' is not assignable to type 'never'.",
      },
      {
        type: "type",
        position: { path: "src/other.ts", line: 3, column: 1 },
        message: "TS6133: 'unused' is declared but its value is never read.",
      },
    ]);
  });

  it("formats colored pretty output without including its source excerpt", () => {
    const escape = "\u001B";
    const output = [
      `${escape}[96msrc/example.ts${escape}[0m:${escape}[93m5${escape}[0m:${escape}[93m3${escape}[0m - ${escape}[91merror${escape}[0m${escape}[90m TS2345: ${escape}[0mArgument is invalid.`,
      "",
      `${escape}[7m5${escape}[0m call(value);`,
      `${escape}[7m ${escape}[0m ${escape}[91m~~~~${escape}[0m`,
      "",
      "Found 1 error in src/example.ts:5",
    ].join("\r\n");

    expect(tscReporter.formatOutput(output)).toEqual([
      {
        type: "type",
        position: { path: "src/example.ts", line: 5, column: 3 },
        message: "TS2345: Argument is invalid.",
      },
    ]);
  });

  it("supports Windows paths and ignores diagnostics without a source position", () => {
    const output = [
      "error TS18003: No inputs were found in config file 'tsconfig.json'.",
      "C:\\project dir\\src\\index.ts(1,2): error TS1005: ';' expected.",
    ].join("\n");

    expect(tscReporter.formatOutput(output)).toEqual([
      {
        type: "type",
        position: {
          path: "C:\\project dir\\src\\index.ts",
          line: 1,
          column: 2,
        },
        message: "TS1005: ';' expected.",
      },
    ]);
  });
});
