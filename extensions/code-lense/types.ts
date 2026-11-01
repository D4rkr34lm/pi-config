export type CodeIssue = {
  type: "build" | "lint" | "format";
  position: {
    path: string;
    line: number;
    column: number;
  };
  message: string;
  sourceExcerpt?: string;
};
