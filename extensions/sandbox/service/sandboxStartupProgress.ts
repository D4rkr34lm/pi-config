export type SandboxStartupProgressEvent =
  | {
      phase: "checking-image";
      definitionName: string;
    }
  | {
      phase: "building-image";
      definitionName: string;
    }
  | {
      phase: "starting-container";
      definitionName: string;
    }
  | {
      phase: "waiting-for-api";
      definitionName: string;
    }
  | {
      phase: "applying-policy";
      definitionName: string;
    }
  | {
      phase: "running-setup";
      definitionName: string;
      commandIndex: number;
      commandCount: number;
    }
  | {
      phase: "activating-tools";
      definitionName: string;
    };

export type SandboxStartupProgressHandler = (
  event: SandboxStartupProgressEvent
) => void;
