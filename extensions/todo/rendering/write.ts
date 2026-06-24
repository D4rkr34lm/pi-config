import { Static } from "typebox";
import { WriteTodosReturnDetails, writeTodosSchema } from "../tools/write";
import { Theme } from "@earendil-works/pi-coding-agent";
import {
  countBadge,
  formatError,
  plural,
  shortText,
  textComponent,
  TodoRenderContext,
} from "./common";

type RenderableTodo = { id: string; title: string; description: string };

function todoRows(
  todos: RenderableTodo[],
  theme: Theme,
  marker: string,
  expanded = false
) {
  return todos.flatMap((todo) => {
    const lines = [
      `${theme.fg("muted", "│")} ${theme.fg("success", marker)} ${theme.bold(
        todo.title
      )} ${theme.fg("dim", `#${todo.id}`)}`,
    ];

    if (expanded && todo.description.trim()) {
      lines.push(
        `${theme.fg("muted", "│")}   ${theme.fg(
          "muted",
          shortText(todo.description)
        )}`
      );
    }

    return lines;
  });
}

function todoSection(
  theme: Theme,
  title: string,
  todos: RenderableTodo[],
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
  const text = textComponent(context);
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
  const component = textComponent(context);

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
  }

  const lines = [
    `${theme.fg("error", "✗")} ${theme.bold("Could not write todos")}`,
    `  ${theme.fg("error", String(result.notExecutableTodos.length))} ${theme.fg(
      "dim",
      "issue(s)"
    )}`,
    ``,
    ...result.notExecutableTodos.map(
      (todo) =>
        `${theme.fg("muted", "│")} ${theme.fg("error", "!")} ${theme.bold(
          todo.todoId
        )} ${theme.fg("muted", formatError(todo.error))}`
    ),
  ];

  component.setText(lines.join("\n"));
  return component;
}
