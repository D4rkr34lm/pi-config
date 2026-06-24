import { Static } from "typebox";
import { WriteTodosReturnDetails, writeTodosSchema } from "../tools/write";
import { Text } from "@earendil-works/pi-tui";
import { Theme } from "@earendil-works/pi-coding-agent";

type TodoRenderContext = {
  isPartial: boolean;
  expanded?: boolean;
  lastComponent?: unknown;
};

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function countBadge(
  theme: Theme,
  count: number,
  label: string,
  color: "success" | "accent" | "muted" = "muted"
) {
  return `${theme.fg(color, String(count))} ${theme.fg("dim", label)}`;
}

function formatError(error: string) {
  return error.replace(/-/g, " ");
}

function shortDescription(description: string) {
  const normalized = description.replace(/\s+/g, " ").trim();
  return normalized.length > 96 ? `${normalized.slice(0, 95)}…` : normalized;
}

function todoRows(
  todos: Array<{ id: string; title: string; description: string }>,
  theme: Theme,
  marker: string,
  expanded = false
) {
  return todos.flatMap((todo, index) => {
    const lines = [
      `${theme.fg("muted", "│")} ${theme.fg("success", marker)} ${theme.bold(
        todo.title
      )} ${theme.fg("dim", `#${todo.id}`)}`,
    ];

    if (expanded && todo.description.trim()) {
      lines.push(
        `${theme.fg("muted", "│")}   ${theme.fg(
          "muted",
          shortDescription(todo.description)
        )}`
      );
    }

    return lines;
  });
}

function todoSection(
  theme: Theme,
  title: string,
  todos: Array<{ id: string; title: string; description: string }>,
  marker: string,
  expanded = false
) {
  if (todos.length === 0) {
    return [];
  }

  return [
    ``,
    `${theme.fg("muted", "╭─")} ${theme.bold(title)} ${theme.fg(
      "dim",
      `(${plural(todos.length, "todo")})`
    )}`,
    ...todoRows(todos, theme, marker, expanded),
    `${theme.fg("muted", "╰─")}`,
  ];
}

export function renderWriteTodoCall(
  args: Static<typeof writeTodosSchema>,
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

  const createCount = args.todos.filter((todo) => !todo.id).length;
  const updateCount = args.todos.length - createCount;

  text.setText(
    [
      `${theme.fg("accent", "✎")} ${theme.bold("Writing todos")}`,
      `  ${countBadge(theme, createCount, "create", "success")}  ${countBadge(
        theme,
        updateCount,
        "update",
        "accent"
      )}`,
    ].join("\n")
  );

  return text;
}

export function renderWriteTodoResult(
  result: WriteTodosReturnDetails,
  theme: Theme,
  context?: TodoRenderContext
) {
  const component =
    context?.lastComponent instanceof Text
      ? context.lastComponent
      : new Text("", 0, 0);

  if (result.success) {
    const total = result.createdTodos.length + result.updatedTodos.length;
    const lines = [
      `${theme.fg("success", "✓")} ${theme.bold(
        `Wrote ${plural(total, "todo")}`
      )}`,
      `  ${countBadge(
        theme,
        result.createdTodos.length,
        "created",
        "success"
      )}  ${countBadge(theme, result.updatedTodos.length, "updated", "accent")}`,
      ...todoSection(
        theme,
        "Created",
        result.createdTodos,
        "+",
        context?.expanded
      ),
      ...todoSection(
        theme,
        "Updated",
        result.updatedTodos,
        "~",
        context?.expanded
      ),
    ];

    component.setText(lines.join("\n"));
    return component;
  } else {
    const lines = [
      `${theme.fg("error", "✗")} ${theme.bold("Could not write todos")}`,
      `  ${theme.fg(
        "error",
        String(result.notExecutableTodos.length)
      )} ${theme.fg("dim", "issue(s)")}`,
      ``,
      ...result.notExecutableTodos.map(
        (todo) =>
          `${theme.fg("muted", "│")} ${theme.fg(
            "error",
            "!"
          )} ${theme.bold(todo.todoId)} ${theme.fg("muted", formatError(todo.error))}`
      ),
    ];

    component.setText(lines.join("\n"));
    return component;
  }
}
