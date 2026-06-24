import { Static } from "@earendil-works/pi-ai";
import Type from "typebox";
import { hasNoValue, hasValue } from "../../../utils/type-guards";
import { TodoStore } from "../store";
import { isEmpty } from "lodash-es";
import { AgentToolResult } from "@earendil-works/pi-coding-agent";

export const writeTodosSchema = Type.Object({
  action: Type.Literal("write"),
  todos: Type.Array(
    Type.Object({
      id: Type.Optional(
        Type.String({ description: "Omit for creation, provide for updates" })
      ),
      title: Type.String({ description: "One line description of todo" }),
      description: Type.String({
        description: "Detailed description of what you need to achieve",
      }),
    })
  ),
});

export type WriteTodosReturnDetails =
  | {
      success: true;
      action: "write";
      createdTodos: Array<{ id: string; title: string; description: string }>;
      updatedTodos: Array<{ id: string; title: string; description: string }>;
    }
  | {
      success: false;
      action: "write";
      notExecutableTodos: Array<{
        todoId: string;
        error:
          | "todo-not-found"
          | "todo-already-completed"
          | "todo-already-aborted";
      }>;
    };

export function executeWriteTodo(
  params: Static<typeof writeTodosSchema>,
  todoStore: TodoStore
): AgentToolResult<WriteTodosReturnDetails> {
  const todosToCreate = params.todos.filter((t) => hasNoValue(t.id));
  const todosToUpdate = params.todos.filter(
    (t): t is { id: string; title: string; description: string } =>
      hasValue(t.id)
  );

  const canUpdateResults = todosToUpdate.map((t) => ({
    todoId: t.id,
    result: todoStore.canUpdateTodo(t.id),
  }));

  const notExecutableTodos = canUpdateResults
    .map((r) =>
      r.result.isErr()
        ? {
            todoId: r.todoId,
            error: r.result.error,
          }
        : null
    )
    .filter(hasValue);

  if (!isEmpty(notExecutableTodos)) {
    return {
      content: [
        {
          type: "text",
          text: [
            `Failed to write ${notExecutableTodos.length} todo${
              notExecutableTodos.length === 1 ? "" : "s"
            }:`,
            ...notExecutableTodos.map((t) => `- ${t.todoId}: ${t.error}`),
          ].join("\n"),
        },
      ],
      details: {
        action: "write",
        success: false,
        notExecutableTodos,
      },
    };
  } else {
    const createdTodos = todosToCreate.map((t) =>
      todoStore.createTodo({ title: t.title, description: t.description })
    );
    const updatedTodos = todosToUpdate.map((t) =>
      todoStore.updateTodo(t.id, {
        title: t.title,
        description: t.description,
      })
    );

    const successfulUpdatedTodos = updatedTodos
      .filter((r) => r.isOk())
      .map((r) => r.value);
    const contentLines = [
      `Wrote ${createdTodos.length + successfulUpdatedTodos.length} todos`,
      `Created: ${createdTodos.length}`,
      ...createdTodos.map((t) => `- ${t.id}: ${t.title}`),
      `Updated: ${successfulUpdatedTodos.length}`,
      ...successfulUpdatedTodos.map((t) => `- ${t.id}: ${t.title}`),
    ];

    return {
      content: [
        {
          type: "text",
          text: contentLines.join("\n"),
        },
      ],
      details: {
        success: true,
        action: "write",
        createdTodos,
        updatedTodos: successfulUpdatedTodos,
      },
    };
  }
}
