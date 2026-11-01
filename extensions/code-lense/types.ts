export type CodeIssue = {
  type: "type" | "lint" | "format" | "build";
  position: {
    path: string;
    line: number;
    column: number;
  };
  message: string;
  sourceExcerpt?: string;
};

export type TestIssue = {
  type: "test";
};

export type RuntimeIssue = {
  type: "runtime";
};

export type Issue = CodeIssue | TestIssue | RuntimeIssue;

export type IssueReporter = {
  id: string;
  formatOutput: (commandOutput: string) => Issue[];
};
