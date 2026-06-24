import { Static } from "typebox";
import { Theme } from "@earendil-works/pi-coding-agent";
import { AbortTodoReturnDetails, abortTodoSchema } from "../tools/abort";
import {
  formatError,
  mutedDetail,
  renderPartialLine,
  textComponent,
  todoId,
  todoSummary,
  TodoRenderContext,
} from "./common";

export function renderAbortTodoCall(
  args: Static<typeof abortTodoSchema>,
  theme: Theme,
  context: TodoRenderContext
) {
  return renderPartialLine(
    theme,
    context,
    "◷",
    "Aborting",
    args.todoId,
    "warning"
  );
}

export function renderAbortTodoResult(
  result: AbortTodoReturnDetails,
  theme: Theme,
  context?: TodoRenderContext
) {
  const component = textComponent(context);

  if (!result.success) {
    component.setText(
      `${theme.fg("error", "✗")} ${theme.bold("Could not abort")} ${todoId(
        theme,
        result.todoId
      )} ${theme.fg("muted", formatError(result.error))}`
    );
    return component;
  }

  const todo = result.todo;
  component.setText(
    [
      todoSummary(theme, todo),
      ...(todo.abortJustification
        ? [mutedDetail(theme, todo.abortJustification)]
        : []),
    ].join("\n")
  );

  return component;
}
