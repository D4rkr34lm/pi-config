import { Static } from "typebox";
import { Theme } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { AbortTodoReturnDetails, abortTodoSchema } from "../tools/abort";

type TodoRenderContext = {
  isPartial: boolean;
  lastComponent?: unknown;
};

function formatError(error: string) {
  return error.replace(/-/g, " ");
}

function shortText(text: string, max = 96) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > max
    ? `${normalized.slice(0, max - 1)}…`
    : normalized;
}

export function renderAbortTodoCall(
  args: Static<typeof abortTodoSchema>,
  theme: Theme,
  context: TodoRenderContext
) {
  const text =
    context.lastComponent instanceof Text
      ? context.lastComponent
      : new Text("", 0, 0);

  if (!context.isPartial) {
    text.setText("");
    return text;
  }

  text.setText(
    `${theme.fg("warning", "◷")} ${theme.bold("Aborting")} ${theme.fg(
      "dim",
      `#${args.todoId}`
    )}`
  );

  return text;
}

export function renderAbortTodoResult(
  result: AbortTodoReturnDetails,
  theme: Theme,
  context?: TodoRenderContext
) {
  const component =
    context?.lastComponent instanceof Text
      ? context.lastComponent
      : new Text("", 0, 0);

  if (!result.success) {
    component.setText(
      `${theme.fg("error", "✗")} ${theme.bold("Could not abort")} ${theme.fg(
        "dim",
        `#${result.todoId}`
      )} ${theme.fg("muted", formatError(result.error))}`
    );
    return component;
  }

  const todo = result.todo;
  component.setText(
    [
      `${theme.fg("error", "✗")} ${theme.bold("Aborted Todo:")} ${theme.bold(
        todo.title
      )} - ${theme.fg("dim", `#${todo.id}`)}`,
      ...(todo.abortJustification
        ? [`  ${theme.fg("muted", shortText(todo.abortJustification))}`]
        : []),
    ].join("\n")
  );

  return component;
}
