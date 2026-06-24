import { Static } from "typebox";
import { Theme } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import {
  CompleteTodoReturnDetails,
  completeTodoSchema,
} from "../tools/complete";

type TodoRenderContext = {
  isPartial: boolean;
  lastComponent?: unknown;
};

function formatError(error: string) {
  return error.replace(/-/g, " ");
}

export function renderCompleteTodoCall(
  args: Static<typeof completeTodoSchema>,
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
    `${theme.fg("accent", "◷")} ${theme.bold("Completing")} ${theme.fg(
      "dim",
      `#${args.todoId}`
    )}`
  );

  return text;
}

export function renderCompleteTodoResult(
  result: CompleteTodoReturnDetails,
  theme: Theme,
  context?: TodoRenderContext
) {
  const component =
    context?.lastComponent instanceof Text
      ? context.lastComponent
      : new Text("", 0, 0);

  if (!result.success) {
    component.setText(
      `${theme.fg("error", "✗")} ${theme.bold("Could not complete")} ${theme.fg(
        "dim",
        `#${result.todoId}`
      )} ${theme.fg("muted", formatError(result.error))}`
    );
    return component;
  }

  const todo = result.todo;
  component.setText(
    `${theme.fg("success", "✓")} ${theme.bold("Completed Todo:")} ${theme.bold(
      todo.title
    )} - ${theme.fg("dim", `#${todo.id}`)}`
  );

  return component;
}
