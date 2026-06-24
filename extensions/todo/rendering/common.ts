import { Theme } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Todo, TodoStatus } from "../store";

export type TodoRenderContext = {
  isPartial: boolean;
  expanded?: boolean;
  lastComponent?: unknown;
};

export type TodoLike = Pick<Todo, "id" | "title" | "description"> &
  Partial<Pick<Todo, "status" | "abortJustification">>;

export function textComponent(context?: { lastComponent?: unknown }) {
  return context?.lastComponent instanceof Text
    ? context.lastComponent
    : new Text("", 0, 0);
}

export function plural(
  count: number,
  singular: string,
  pluralForm = `${singular}s`
) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function countBadge(
  theme: Theme,
  count: number,
  label: string,
  color: "success" | "accent" | "error" | "muted" = "muted"
) {
  return `${theme.fg(color, String(count))} ${theme.fg("dim", label)}`;
}

export function formatError(error: string) {
  return error.replace(/-/g, " ");
}

export function shortText(text: string, max = 96) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > max
    ? `${normalized.slice(0, max - 1)}…`
    : normalized;
}

export function todoId(theme: Theme, id: string) {
  return theme.fg("dim", `#${id}`);
}

export function statusIcon(theme: Theme, status: TodoStatus = "pending") {
  switch (status) {
    case "completed":
      return theme.fg("success", "✓");
    case "aborted":
      return theme.fg("error", "✗");
    case "pending":
      return theme.fg("accent", "☐");
  }
}

export function statusLabel(status: TodoStatus = "pending") {
  switch (status) {
    case "completed":
      return "Completed";
    case "aborted":
      return "Aborted";
    case "pending":
      return "Open";
  }
}

export function todoSummary(theme: Theme, todo: TodoLike) {
  return `${statusIcon(theme, todo.status)} ${theme.bold(
    `${statusLabel(todo.status)} Todo:`
  )} ${theme.bold(todo.title)} - ${todoId(theme, todo.id)}`;
}

export function mutedDetail(theme: Theme, text: string) {
  return `  ${theme.fg("muted", shortText(text))}`;
}

export function renderPartialLine(
  theme: Theme,
  context: TodoRenderContext,
  icon: string,
  label: string,
  id?: string,
  color: "accent" | "warning" = "accent"
) {
  const text = textComponent(context);

  if (!context.isPartial) {
    text.setText("");
    return text;
  }

  text.setText(
    `${theme.fg(color, icon)} ${theme.bold(label)}${id ? ` ${todoId(theme, id)}` : ""}`
  );
  return text;
}
