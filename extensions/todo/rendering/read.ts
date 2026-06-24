import { Static } from "typebox";
import { Theme } from "@earendil-works/pi-coding-agent";
import { Todo } from "../store";
import { ReadTodosReturnDetails, readTodosSchema } from "../tools/read";
import {
  countBadge,
  formatError,
  mutedDetail,
  plural,
  renderPartialLine,
  shortText,
  textComponent,
  todoSummary,
  TodoRenderContext,
} from "./common";

const COLLAPSED_TODO_LIMIT = 20;

function todoLine(todo: Todo, theme: Theme) {
  return `${theme.fg("muted", "│")} ${todoSummary(theme, todo)}`;
}

function todoRows(todos: Todo[], theme: Theme, expanded = false) {
  const visibleTodos = expanded ? todos : todos.slice(0, COLLAPSED_TODO_LIMIT);
  const remaining = todos.length - visibleTodos.length;
  const rows = visibleTodos.flatMap((todo) => {
    const lines = [todoLine(todo, theme)];

    if (expanded && todo.description.trim()) {
      lines.push(
        `${theme.fg("muted", "│")} ${mutedDetail(theme, todo.description)}`
      );
    }

    if (expanded && todo.abortJustification?.trim()) {
      lines.push(
        `${theme.fg("muted", "│")} ${mutedDetail(
          theme,
          `reason: ${shortText(todo.abortJustification)}`
        )}`
      );
    }

    return lines;
  });

  if (remaining > 0) {
    rows.push(
      `${theme.fg("muted", "│")} ${theme.fg(
        "dim",
        `… ${plural(remaining, "more todo")}`
      )}`
    );
  }

  return rows;
}

function todoListSection(
  theme: Theme,
  title: string,
  todos: Todo[],
  expanded = false
) {
  return [
    `${theme.fg("muted", "╭─")} ${theme.bold(title)} ${theme.fg(
      "dim",
      todos.length === 0 ? "(empty)" : `(${plural(todos.length, "todo")})`
    )}`,
    ...(todos.length === 0
      ? [`${theme.fg("muted", "│")} ${theme.fg("muted", "No pending todos")}`]
      : todoRows(todos, theme, expanded)),
    `${theme.fg("muted", "╰─")}`,
  ];
}

export function renderReadTodoCall(
  args: Static<typeof readTodosSchema>,
  theme: Theme,
  context: TodoRenderContext
) {
  return args.todoId
    ? renderPartialLine(theme, context, "◷", "Reading", args.todoId)
    : renderPartialLine(theme, context, "◷", "Reading open todos");
}

export function renderReadTodoResult(
  result: ReadTodosReturnDetails,
  theme: Theme,
  context?: TodoRenderContext
) {
  const component = textComponent(context);

  if (!result.success) {
    component.setText(
      `${theme.fg("error", "✗")} ${theme.bold("Todo not found")} ${theme.fg(
        "muted",
        formatError(result.error)
      )}`
    );
    return component;
  }

  if ("todo" in result) {
    const todo = result.todo;
    const lines = [
      todoSummary(theme, todo),
      ...(todo.description.trim()
        ? [mutedDetail(theme, todo.description)]
        : []),
      ...(todo.abortJustification?.trim()
        ? [mutedDetail(theme, `reason: ${todo.abortJustification}`)]
        : []),
    ];

    component.setText(lines.join("\n"));
    return component;
  }

  const todos = result.todos;
  const lines = [
    `${theme.fg("success", "✓")} ${theme.bold(
      `Read ${plural(todos.length, "open todo")}`
    )}`,
    `  ${countBadge(theme, todos.length, "pending", "accent")}`,
    ``,
    ...todoListSection(theme, "Open", todos, context?.expanded),
  ];

  component.setText(lines.join("\n"));
  return component;
}
