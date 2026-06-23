import { StringEnum } from "@earendil-works/pi-ai";
import type {
  AgentToolResult,
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import {
  compact,
  concat,
  filter,
  find,
  includes,
  isArray,
  isEmpty,
  isNil,
  isNumber,
  isPlainObject,
  isString,
  join,
  last,
  map,
  max,
  size,
  take,
  trim,
  truncate,
  upperFirst,
} from "lodash-es";
import { Type } from "typebox";

type TodoStatus = "open" | "completed";

type Todo = {
  id: number;
  brief: string;
  long: string;
  status: TodoStatus;
  createdAt: number;
  updatedAt: number;
};

type TodoState = {
  todos: Todo[];
};

type TodoReadFilter = "all" | TodoStatus;

type TodoCreateInput = {
  brief: string;
  long: string;
  status?: TodoStatus;
};

type TodoWriteParams = {
  id?: number;
  brief?: string;
  long?: string;
  status?: TodoStatus;
  todos?: TodoCreateInput[];
};

type TodoReadParams = {
  id?: number;
  status?: TodoReadFilter;
};

type TodoChangeStatusParams = {
  id: number;
  status: TodoStatus;
};

type TodoReadDetails = {
  todos: Todo[];
  filter: TodoReadParams;
  error?: string;
};

type TodoListWindow = {
  visible: Todo[];
  beforeCount: number;
  afterCount: number;
};

const CUSTOM_TYPE = "todos-state";
const MAX_BRIEF_WIDTH = 60;
const MAX_RENDERED_TODOS = 5;

const todoStatusSchema = StringEnum(["open", "completed"] as const);

const TodoWriteParamsSchema = Type.Object({
  id: Type.Optional(
    Type.Number({
      description:
        "Existing todo id to update. Omit id when creating todos with the todos array.",
    })
  ),
  brief: Type.Optional(
    Type.String({
      description: `Short display title for updating an existing todo. Keep this at or below ${MAX_BRIEF_WIDTH} characters.`,
    })
  ),
  long: Type.Optional(
    Type.String({
      description:
        "Full todo details/description for updating an existing todo.",
    })
  ),
  status: Type.Optional(todoStatusSchema),
  todos: Type.Optional(
    Type.Array(
      Type.Object({
        brief: Type.String({
          description: `Short display title. Keep this at or below ${MAX_BRIEF_WIDTH} characters.`,
        }),
        long: Type.String({ description: "Full todo details/description." }),
        status: Type.Optional(todoStatusSchema),
      }),
      {
        description:
          "Todos to create. Use this array for creating one or more todos, including a single-item array for one todo.",
      }
    )
  ),
});

const TodoReadParamsSchema = Type.Object({
  id: Type.Optional(
    Type.Number({
      description:
        "Specific todo id to read. When omitted, todo_read lists todos.",
    })
  ),
  status: Type.Optional(StringEnum(["all", "open", "completed"] as const)),
});

const TodoChangeStatusParamsSchema = Type.Object({
  id: Type.Number({ description: "Todo id to update." }),
  status: todoStatusSchema,
});

const now = () => Date.now();

const isTodo = (value: unknown): value is Todo => {
  if (!isPlainObject(value)) return false;
  const todo = value as Todo;
  return (
    isNumber(todo.id) &&
    isString(todo.brief) &&
    isString(todo.long) &&
    includes(["open", "completed"], todo.status) &&
    isNumber(todo.createdAt) &&
    isNumber(todo.updatedAt)
  );
};

const getStateFromEntry = (entry: unknown): TodoState | undefined => {
  if (!isPlainObject(entry)) return undefined;
  const candidate = entry as {
    type?: unknown;
    customType?: unknown;
    data?: unknown;
  };
  if (candidate.type !== "custom" || candidate.customType !== CUSTOM_TYPE)
    return undefined;
  if (!isPlainObject(candidate.data)) return undefined;
  const data = candidate.data as { todos?: unknown };
  if (!isArray(data.todos)) return undefined;
  return { todos: filter(data.todos, isTodo) };
};

const rehydrateTodos = (ctx: ExtensionContext): Todo[] => {
  const states = compact(
    map(ctx.sessionManager.getBranch(), getStateFromEntry)
  );
  const latest = last(states);
  return latest ? latest.todos : [];
};

const normalizeBrief = (brief: string): string =>
  truncate(trim(brief), { length: MAX_BRIEF_WIDTH, omission: "…" });

const normalizeLong = (long: string): string => trim(long);

const nextId = (todos: Todo[]): number => (max(map(todos, "id")) ?? 0) + 1;

const findTodo = (todos: Todo[], id: number): Todo | undefined =>
  find(todos, { id });

const createTodos = (
  todos: Todo[],
  items: TodoCreateInput[] | undefined
): {
  todos: Todo[];
  created?: Todo[];
  error?: string;
} => {
  if (!isArray(items) || isEmpty(items)) {
    return { todos, error: "todos array is required when creating todos" };
  }

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (isNil(item) || !isPlainObject(item)) {
      return { todos, error: `todos[${index}] must be an object` };
    }
    if (!isString(item.brief) || isEmpty(trim(item.brief))) {
      return { todos, error: `todos[${index}].brief is required` };
    }
    if (!isString(item.long) || isEmpty(trim(item.long))) {
      return { todos, error: `todos[${index}].long is required` };
    }
  }

  const timestamp = now();
  const firstId = nextId(todos);
  const created = map(
    items,
    (item: TodoCreateInput, index: number): Todo => ({
      id: firstId + index,
      brief: normalizeBrief(item.brief),
      long: normalizeLong(item.long),
      status: item.status ?? "open",
      createdAt: timestamp,
      updatedAt: timestamp,
    })
  );

  return { todos: concat(todos, created), created };
};

const updateTodo = (
  todos: Todo[],
  params: TodoWriteParams
): {
  todos: Todo[];
  todo?: Todo;
  error?: string;
} => {
  const id = params.id;
  if (isNil(id)) {
    return { todos, error: "id is required when updating a todo" };
  }

  const existing = findTodo(todos, id);
  if (isNil(existing)) {
    return { todos, error: `todo #${id} not found` };
  }

  const brief = params.brief;
  const long = params.long;
  const updated: Todo = {
    ...existing,
    brief: isString(brief) ? normalizeBrief(brief) : existing.brief,
    long: isString(long) ? normalizeLong(long) : existing.long,
    status: params.status ?? existing.status,
    updatedAt: now(),
  };

  return {
    todos: map(todos, (todo: Todo) =>
      todo.id === updated.id ? updated : todo
    ),
    todo: updated,
  };
};

const changeTodoStatus = (
  todos: Todo[],
  params: TodoChangeStatusParams
): { todos: Todo[]; todo?: Todo; error?: string } => {
  const existing = findTodo(todos, params.id);
  if (isNil(existing)) return { todos, error: `todo #${params.id} not found` };

  const updated: Todo = {
    ...existing,
    status: params.status,
    updatedAt: now(),
  };
  return {
    todos: map(todos, (todo: Todo) =>
      todo.id === updated.id ? updated : todo
    ),
    todo: updated,
  };
};

const selectTodos = (todos: Todo[], params: TodoReadParams): Todo[] => {
  if (isNumber(params.id)) return compact([findTodo(todos, params.id)]);
  if (isNil(params.status) || params.status === "all") return todos;
  return filter(todos, { status: params.status });
};

const completedTodos = (todos: Todo[]): Todo[] =>
  filter(todos, { status: "completed" });
const openTodos = (todos: Todo[]): Todo[] => filter(todos, { status: "open" });

const formatTodoLine = (todo: Todo): string =>
  `#${todo.id} [${todo.status}] ${todo.brief}`;

const formatTodoDetails = (todo: Todo): string =>
  `${formatTodoLine(todo)}\n${todo.long}`;

const selectTodoListWindow = (todos: Todo[]): TodoListWindow => {
  const completed = completedTodos(todos);
  const open = openTodos(todos);
  const visibleCompleted = completed.slice(-2);
  const openSlots = MAX_RENDERED_TODOS - size(visibleCompleted);
  const visibleOpen = take(open, openSlots);

  return {
    visible: concat(visibleCompleted, visibleOpen),
    beforeCount: size(completed) - size(visibleCompleted),
    afterCount: size(open) - size(visibleOpen),
  };
};

const formatTodoStatusMarker = (todo: Todo): string =>
  todo.status === "completed" ? "x" : " ";

const formatTodoListItem = (todo: Todo, index: number): string =>
  `${index + 1}. #${todo.id} [${formatTodoStatusMarker(todo)}] ${todo.brief}`;

const formatBeforeTodosMarker = (count: number): string => `+${count} previous`;

const formatAfterTodosMarker = (count: number): string => `+${count} more`;

const formatTodoCountHeader = (todos: Todo[]): string =>
  `Todos: ${size(openTodos(todos))} open / ${size(completedTodos(todos))} completed`;

export const formatTodoFooterStatus = (todos: Todo[]): string => {
  const open = openTodos(todos);
  const completed = completedTodos(todos);
  const visibleOpen = take(open, MAX_RENDERED_TODOS);
  const moreCount = size(open) - size(visibleOpen);
  const titleText = join(map(visibleOpen, "brief"), ", ");
  const moreText = moreCount > 0 ? `, +${moreCount} more` : "";
  const titles = isEmpty(titleText) ? "" : ` | ${titleText}${moreText}`;

  return `Todos: ${size(open)} Open / ${size(completed)} Completed${titles}`;
};

export const formatTodoItemsOnlyList = (todos: Todo[]): string => {
  if (isEmpty(todos)) return "Todos: 0 open / 0 completed";
  return `${formatTodoCountHeader(todos)}\n${join(map(todos, formatTodoListItem), "\n")}`;
};

export const formatTodoList = (todos: Todo[]): string => {
  if (isEmpty(todos)) return "Todos: 0 open / 0 completed";

  const window = selectTodoListWindow(todos);
  const lines = compact([
    window.beforeCount > 0 ? formatBeforeTodosMarker(window.beforeCount) : "",
    ...map(window.visible, formatTodoListItem),
    window.afterCount > 0 ? formatAfterTodosMarker(window.afterCount) : "",
  ]);

  return `${formatTodoCountHeader(todos)}\n${join(lines, "\n")}`;
};

const renderFooterStatus = (ctx: ExtensionContext, todos: Todo[]): string => {
  const theme = ctx.ui.theme;
  const open = openTodos(todos);
  const completed = completedTodos(todos);
  const visibleOpen = take(open, MAX_RENDERED_TODOS);
  const moreCount = size(open) - size(visibleOpen);
  const titleText = join(map(visibleOpen, "brief"), ", ");
  const moreText = moreCount > 0 ? theme.fg("dim", `, +${moreCount} more`) : "";
  const titles = isEmpty(titleText)
    ? ""
    : theme.fg("dim", ` | ${titleText}`) + moreText;

  return (
    "Todos: " +
    theme.fg("dim", `${size(open)} Open`) +
    " / " +
    theme.fg("success", `${size(completed)} Completed`) +
    titles
  );
};

const setFooterStatus = (ctx: ExtensionContext, todos: Todo[]) => {
  ctx.ui.setStatus("todos", renderFooterStatus(ctx, todos));
};

const persistTodos = (pi: ExtensionAPI, todos: Todo[]) => {
  pi.appendEntry<TodoState>(CUSTOM_TYPE, { todos });
};

const readableAction = (action: "created" | "updated", todo: Todo) =>
  `${upperFirst(action)} todo #${todo.id}: ${todo.brief}`;

export default function (pi: ExtensionAPI) {
  let todos: Todo[] = [];

  const refreshFromSession = (ctx: ExtensionContext) => {
    todos = rehydrateTodos(ctx);
    setFooterStatus(ctx, todos);
  };

  pi.on("session_start", async (_event, ctx) => refreshFromSession(ctx));
  pi.on("session_tree", async (_event, ctx) => refreshFromSession(ctx));

  pi.registerTool({
    name: "todo_write",
    label: "Write Todo",
    description:
      "Create one or more todos with the todos array, or update an existing todo when id is provided. Todos have brief and long text fields.",
    promptSnippet: "Create todos in bulk, or update one existing todo by id",
    promptGuidelines: [
      "Use todo_write with a todos array when the user asks to create one or more todos. For a single todo, provide an array with one item.",
      "Use top-level id, brief, long, and status only when updating an existing todo.",
    ],
    parameters: TodoWriteParamsSchema,
    async execute(
      _toolCallId,
      params: TodoWriteParams,
      _signal,
      _onUpdate,
      ctx
    ) {
      if (isArray(params.todos)) {
        const hadTodosBeforeCreate = !isEmpty(todos);
        const result = createTodos(todos, params.todos);
        const created = result.created;
        if (result.error || isNil(created)) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: ${result.error ?? "todo write failed"}`,
              },
            ],
            details: { error: result.error, todos },
          };
        }

        todos = result.todos;
        persistTodos(pi, todos);
        setFooterStatus(ctx, todos);

        return {
          content: [
            {
              type: "text" as const,
              text: hadTodosBeforeCreate
                ? formatTodoList(todos)
                : formatTodoItemsOnlyList(created),
            },
          ],
          details: {
            action: "created",
            created,
            todos,
            hadTodosBeforeCreate,
          },
        };
      }

      const result = updateTodo(todos, params);
      const todo = result.todo;
      if (result.error || isNil(todo)) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${result.error ?? "todo write failed"}`,
            },
          ],
          details: { error: result.error, todos },
        };
      }

      todos = result.todos;
      persistTodos(pi, todos);
      setFooterStatus(ctx, todos);

      return {
        content: [
          {
            type: "text" as const,
            text: readableAction("updated", todo),
          },
        ],
        details: { action: "updated", todo, todos },
      };
    },
    renderCall(args, theme) {
      if (isArray(args.todos)) {
        return new Text(
          theme.fg("toolTitle", theme.bold("todo_write ")) +
            theme.fg(
              "muted",
              `create ${size(args.todos)} todo${size(args.todos) === 1 ? "" : "s"}`
            ),
          0,
          0
        );
      }

      const briefText = args.brief;
      const brief = isString(briefText)
        ? ` ${theme.fg("dim", `"${normalizeBrief(briefText)}"`)}`
        : "";
      const id = isNumber(args.id)
        ? ` ${theme.fg("accent", `#${args.id}`)}`
        : "";
      return new Text(
        theme.fg("toolTitle", theme.bold("todo_write ")) +
          theme.fg("muted", "update") +
          id +
          brief,
        0,
        0
      );
    },
    renderResult(result, _options, theme) {
      const details = result.details as
        | {
            error?: string;
            action?: string;
            todo?: Todo;
            created?: Todo[];
            todos?: Todo[];
            hadTodosBeforeCreate?: boolean;
          }
        | undefined;
      if (details?.error)
        return new Text(theme.fg("error", details.error), 0, 0);
      if (details?.created) {
        const renderTodos = details.hadTodosBeforeCreate
          ? (details.todos ?? details.created)
          : details.created;
        const window = details.hadTodosBeforeCreate
          ? selectTodoListWindow(renderTodos)
          : { visible: renderTodos, beforeCount: 0, afterCount: 0 };
        const lines = compact([
          window.beforeCount > 0
            ? theme.fg("dim", formatBeforeTodosMarker(window.beforeCount))
            : "",
          ...map(
            window.visible,
            (todo: Todo, index: number) =>
              `${theme.fg("muted", `${index + 1}.`)} ${theme.fg("accent", `#${todo.id}`)} ${theme.fg(todo.status === "completed" ? "success" : "muted", `[${formatTodoStatusMarker(todo)}]`)} ${theme.fg("toolTitle", todo.brief)}`
          ),
          window.afterCount > 0
            ? theme.fg("dim", formatAfterTodosMarker(window.afterCount))
            : "",
        ]);

        return new Text(
          `${formatTodoCountHeader(renderTodos)}\n${join(lines, "\n")}`,
          0,
          0
        );
      }
      if (details?.todo) {
        const todo = details.todo;
        return new Text(
          theme.fg("success", "✓ ") +
            theme.fg(
              "muted",
              readableAction(
                details.action === "updated" ? "updated" : "created",
                todo
              )
            ),
          0,
          0
        );
      }
      return new Text("todo_write complete", 0, 0);
    },
  });

  pi.registerTool({
    name: "todo_read",
    label: "Read Todos",
    description:
      "Read a specific todo by id, or list todos with an optional status filter.",
    promptSnippet: "Read one todo by id or list todos by status",
    promptGuidelines: [
      "Use todo_read when you need to inspect current todos or the long details for a specific todo.",
    ],
    parameters: TodoReadParamsSchema,
    async execute(
      _toolCallId,
      params: TodoReadParams
    ): Promise<AgentToolResult<TodoReadDetails>> {
      const selected = selectTodos(todos, params);
      if (isNumber(params.id) && isEmpty(selected)) {
        return {
          content: [
            { type: "text" as const, text: `Todo #${params.id} not found` },
          ],
          details: {
            error: `todo #${params.id} not found`,
            todos,
            filter: params,
          },
        };
      }

      const selectedTodo = selected[0];
      const text =
        isNumber(params.id) && selectedTodo
          ? formatTodoDetails(selectedTodo)
          : formatTodoList(selected);
      return {
        content: [{ type: "text" as const, text }],
        details: { todos: selected, filter: params },
      };
    },
    renderCall(args, theme) {
      const id = isNumber(args.id)
        ? ` ${theme.fg("accent", `#${args.id}`)}`
        : "";
      const statusText = args.status;
      const status = isString(statusText)
        ? ` ${theme.fg("muted", statusText)}`
        : "";
      return new Text(
        theme.fg("toolTitle", theme.bold("todo_read")) + id + status,
        0,
        0
      );
    },
    renderResult(result, _options, theme) {
      const details = result.details as
        | { error?: string; todos?: Todo[] }
        | undefined;
      if (details?.error)
        return new Text(theme.fg("error", details.error), 0, 0);
      const selected = details?.todos ?? [];
      if (isEmpty(selected))
        return new Text(theme.fg("dim", "No todos matched."), 0, 0);
      const window = selectTodoListWindow(selected);
      const lines = compact([
        window.beforeCount > 0
          ? theme.fg("dim", formatBeforeTodosMarker(window.beforeCount))
          : "",
        ...map(
          window.visible,
          (todo: Todo, index: number) =>
            `${theme.fg("muted", `${index + 1}.`)} ${theme.fg("accent", `#${todo.id}`)} ${theme.fg(todo.status === "completed" ? "success" : "muted", `[${formatTodoStatusMarker(todo)}]`)} ${theme.fg("toolTitle", todo.brief)}`
        ),
        window.afterCount > 0
          ? theme.fg("dim", formatAfterTodosMarker(window.afterCount))
          : "",
      ]);

      return new Text(
        `${formatTodoCountHeader(selected)}\n${join(lines, "\n")}`,
        0,
        0
      );
    },
  });

  pi.registerTool({
    name: "todo_change_status",
    label: "Change Todo Status",
    description: "Change a todo status to open or completed.",
    promptSnippet: "Mark todos open or completed",
    promptGuidelines: [
      "Use todo_change_status when the user says a todo is done, completed, reopened, or still open.",
    ],
    parameters: TodoChangeStatusParamsSchema,
    async execute(
      _toolCallId,
      params: TodoChangeStatusParams,
      _signal,
      _onUpdate,
      ctx
    ) {
      const result = changeTodoStatus(todos, params);
      const todo = result.todo;
      if (result.error || isNil(todo)) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${result.error ?? "status change failed"}`,
            },
          ],
          details: { error: result.error, todos },
        };
      }

      todos = result.todos;
      persistTodos(pi, todos);
      setFooterStatus(ctx, todos);

      return {
        content: [
          {
            type: "text" as const,
            text: `Todo #${todo.id} is now ${todo.status}: ${todo.brief}`,
          },
        ],
        details: { todo, todos },
      };
    },
    renderCall(args, theme) {
      return new Text(
        theme.fg("toolTitle", theme.bold("todo_change_status ")) +
          theme.fg("accent", `#${args.id}`) +
          " " +
          theme.fg(
            args.status === "completed" ? "success" : "dim",
            args.status
          ),
        0,
        0
      );
    },
    renderResult(result, _options, theme) {
      const details = result.details as
        | { error?: string; todo?: Todo }
        | undefined;
      if (details?.error)
        return new Text(theme.fg("error", details.error), 0, 0);
      if (details?.todo) {
        return new Text(
          theme.fg(
            details.todo.status === "completed" ? "success" : "dim",
            details.todo.status === "completed" ? "✓ " : "○ "
          ) +
            theme.fg(
              "muted",
              `${details.todo.brief} is ${details.todo.status}`
            ),
          0,
          0
        );
      }
      return new Text("todo_change_status complete", 0, 0);
    },
  });
}
