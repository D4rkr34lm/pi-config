export type TypeIssue = {
  type: "type";
  position: {
    path: string;
    line: number;
    column: number;
  };
  message: string;
};

export type TestIssue = {
  type: "test";
};

export type RuntimeIssue = {
  type: "runtime";
};

export type Issue = TypeIssue | TestIssue | RuntimeIssue;

export type IssueReporter = {
  id: string;
  formatOutput: (commandOutput: string) => Issue[];
};
