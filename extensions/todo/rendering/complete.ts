import { Static } from "typebox";
import { Theme } from "@earendil-works/pi-coding-agent";
import {
  CompleteTodoReturnDetails,
  completeTodoSchema,
} from "../tools/complete";
import {
  formatError,
  renderPartialLine,
  textComponent,
  todoId,
  todoSummary,
  TodoRenderContext,
} from "./common";

export function renderCompleteTodoCall(
  args: Static<typeof completeTodoSchema>,
  theme: Theme,
  context: TodoRenderContext
) {
  return renderPartialLine(theme, context, "◷", "Completing", args.todoId);
}

export function renderCompleteTodoResult(
  result: CompleteTodoReturnDetails,
  theme: Theme,
  context?: TodoRenderContext
) {
  const component = textComponent(context);

  if (!result.success) {
    component.setText(
      `${theme.fg("error", "✗")} ${theme.bold("Could not complete")} ${todoId(
        theme,
        result.todoId
      )} ${theme.fg("muted", formatError(result.error))}`
    );
    return component;
  }

  component.setText(todoSummary(theme, result.todo));
  return component;
}
