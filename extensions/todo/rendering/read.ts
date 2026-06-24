import { Static } from "typebox";
import { Theme } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Todo } from "../store";
import { ReadTodosReturnDetails, readTodosSchema } from "../tools/read";

type TodoRenderContext = {
  isPartial: boolean;
  expanded?: boolean;
  lastComponent?: unknown;
};

const COLLAPSED_TODO_LIMIT = 20;

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function countBadge(theme: Theme, count: number, label: string) {
  return `${theme.fg("accent", String(count))} ${theme.fg("dim", label)}`;
}

function shortText(text: string, max = 96) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > max
    ? `${normalized.slice(0, max - 1)}…`
    : normalized;
}

function statusIcon(todo: Todo, theme: Theme) {
  switch (todo.status) {
    case "completed":
      return theme.fg("success", "✓");
    case "aborted":
      return theme.fg("error", "✗");
    case "pending":
      return theme.fg("accent", "☐");
  }
}

function statusLabel(todo: Todo) {
  switch (todo.status) {
    case "completed":
      return "Completed";
    case "aborted":
      return "Aborted";
    case "pending":
      return "Open";
  }
}

function todoSummary(todo: Todo, theme: Theme) {
  return `${statusIcon(todo, theme)} ${theme.bold(`${statusLabel(todo)} Todo:`)} ${theme.bold(
    todo.title
  )} - ${theme.fg("dim", `#${todo.id}`)}`;
}

function todoLine(todo: Todo, theme: Theme) {
  return `${theme.fg("muted", "│")} ${todoSummary(todo, theme)}`;
}

function todoRows(todos: Todo[], theme: Theme, expanded = false) {
  const visibleTodos = expanded ? todos : todos.slice(0, COLLAPSED_TODO_LIMIT);
  const remaining = todos.length - visibleTodos.length;
  const rows = visibleTodos.flatMap((todo) => {
    const lines = [todoLine(todo, theme)];

    if (expanded && todo.description.trim()) {
      lines.push(
        `${theme.fg("muted", "│")}   ${theme.fg(
          "muted",
          shortText(todo.description)
        )}`
      );
    }

    if (expanded && todo.abortJustification?.trim()) {
      lines.push(
        `${theme.fg("muted", "│")}   ${theme.fg(
          "error",
          `aborted: ${shortText(todo.abortJustification)}`
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
  const text =
    context.lastComponent instanceof Text
      ? context.lastComponent
      : new Text("", 0, 0);

  if (!context.isPartial) {
    text.setText("");
    return text;
  }

  text.setText(
    args.todoId
      ? `${theme.fg("accent", "◷")} ${theme.bold("Reading todo")} ${theme.fg(
          "dim",
          `#${args.todoId}`
        )}`
      : `${theme.fg("accent", "◷")} ${theme.bold("Reading open todos")}`
  );

  return text;
}

export function renderReadTodoResult(
  result: ReadTodosReturnDetails,
  theme: Theme,
  context?: TodoRenderContext
) {
  const component =
    context?.lastComponent instanceof Text
      ? context.lastComponent
      : new Text("", 0, 0);

  if (!result.success) {
    component.setText(
      [
        `${theme.fg("error", "✗")} ${theme.bold("Todo not found")}`,
        `${theme.fg("muted", "╭─")} ${theme.bold("Error")}`,
        `${theme.fg("muted", "│")} ${theme.fg(
          "muted",
          result.error.replace(/-/g, " ")
        )}`,
        `${theme.fg("muted", "╰─")}`,
      ].join("\n")
    );
    return component;
  }

  if ("todo" in result) {
    const todo = result.todo;
    const lines = [
      todoSummary(todo, theme),
      ...(todo.description.trim()
        ? [`  ${theme.fg("muted", shortText(todo.description))}`]
        : []),
      ...(todo.abortJustification?.trim()
        ? [
            `  ${theme.fg("muted", `reason: ${shortText(todo.abortJustification)}`)}`,
          ]
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
    `  ${countBadge(theme, todos.length, "pending")}`,
    ``,
    ...todoListSection(theme, "Open", todos, context?.expanded),
  ];

  component.setText(lines.join("\n"));
  return component;
}
