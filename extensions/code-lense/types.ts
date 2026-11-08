export interface Issue {
  provider: string;
  location: {
    file: string;
    line: number;
    character: number;
  };
  message: string;
  severity: "error" | "warning" | "info";
}

export interface Provider {
  getIssues: () => Promise<Issue[]>;
  close: () => Promise<void>;
}
