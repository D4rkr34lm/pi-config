import * as ts from "@typescript/typescript6";
import { Issue } from "../../types";

export function createChecker(configPath: string) {
  let diagnostics: readonly ts.Diagnostic[] = [];

  const host = ts.createWatchCompilerHost(
    configPath,
    { noEmit: true },
    ts.sys,
    ts.createSemanticDiagnosticsBuilderProgram,
    () => {}
  );

  host.afterProgramCreate = (program) => {
    diagnostics = [
      ...program.getConfigFileParsingDiagnostics(),
      ...program.getOptionsDiagnostics(),
      ...program.getGlobalDiagnostics(),
      ...program.getSyntacticDiagnostics(),
      ...program.getSemanticDiagnostics(),
    ];
  };

  const watcher = ts.createWatchProgram(host);

  return {
    getDiagnostics: () => diagnostics,
    synchronize: () => watcher.getProgram(),
    close: () => watcher.close(),
  };
}

function mapTscIssue(issue: ts.Diagnostic): Issue {
  return {
    provider: "tsc",
    location: {
      file: issue.file?.fileName || "",
      line:
        issue.start !== undefined && issue.file
          ? issue.file.getLineAndCharacterOfPosition(issue.start).line + 1
          : 0,
      character:
        issue.start !== undefined && issue.file
          ? issue.file.getLineAndCharacterOfPosition(issue.start).character + 1
          : 0,
    },
    message: ts.flattenDiagnosticMessageText(issue.messageText, "\n"),
    severity:
      issue.category === ts.DiagnosticCategory.Error ? "error" : "warning",
  };
}

export function buildTsc6Provider(typescriptConfigPaths: string[]) {
  const watchers = typescriptConfigPaths.map((configPath) =>
    createChecker(configPath)
  );

  return {
    getIssues: async () => {
      watchers.forEach((watcher) => watcher.synchronize());
      const issues = watchers.flatMap((watcher) =>
        watcher.getDiagnostics().map(mapTscIssue)
      );
      return issues;
    },
    close: async () => {
      watchers.forEach((watcher) => watcher.close());
    },
  };
}
