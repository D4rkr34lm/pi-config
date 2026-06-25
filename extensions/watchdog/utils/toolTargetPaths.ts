import {
  type ToolCallEvent,
  isToolCallEventType,
} from "@earendil-works/pi-coding-agent";
import { extractFileMatchesFromShellCommand } from "./shellPathMatcher";

export type TargetPath = {
  value: string;
  source: string;
};

export function getToolTargetPaths(event: ToolCallEvent): TargetPath[] {
  if (isToolCallEventType("read", event)) {
    return [{ value: event.input.path, source: "read.path" }];
  }

  if (isToolCallEventType("write", event)) {
    return [{ value: event.input.path, source: "write.path" }];
  }

  if (isToolCallEventType("edit", event)) {
    return [{ value: event.input.path, source: "edit.path" }];
  }

  if (isToolCallEventType("ls", event)) {
    return event.input.path
      ? [{ value: event.input.path, source: "ls.path" }]
      : [];
  }

  if (isToolCallEventType("grep", event)) {
    return compactTargets([
      event.input.path
        ? { value: event.input.path, source: "grep.path" }
        : undefined,
      event.input.glob
        ? { value: event.input.glob, source: "grep.glob" }
        : undefined,
    ]);
  }

  if (isToolCallEventType("find", event)) {
    return compactTargets([
      event.input.path
        ? { value: event.input.path, source: "find.path" }
        : undefined,
      { value: event.input.pattern, source: "find.pattern" },
    ]);
  }

  if (isToolCallEventType("bash", event)) {
    return extractFileMatchesFromShellCommand(event.input.command).map(
      (match) => ({
        value: match.value,
        source: `bash ${match.kind} (${match.raw})`,
      })
    );
  }

  return [];
}

function compactTargets(targets: Array<TargetPath | undefined>): TargetPath[] {
  return targets.filter((target): target is TargetPath => target !== undefined);
}
