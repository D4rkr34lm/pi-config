import { isEmpty } from "lodash-es";
import Type, { Static } from "typebox";
import { hasNoValue, hasValue } from "../../../utils/type-guards";
import { Todo, TodoStore } from "../store";
import { AgentToolResult } from "@earendil-works/pi-coding-agent";

export const readTodosSchema = Type.Object({
  action: Type.Literal("read"),
  todoId: Type.Optional(
    Type.String({
      description: "If provided, fetches a specific todo else all open todos",
    })
  ),
});

export type ReadTodosReturnDetails =
  | {
      success: true;
      action: "read";
      todo: Todo;
    }
  | {
      success: true;
      action: "read";
      todos: Todo[];
    }
  | {
      success: false;
      action: "read";
      error: "todo-not-found";
    };

export function executeReadTodo(
  params: Static<typeof readTodosSchema>,
  todoStore: TodoStore
): AgentToolResult<ReadTodosReturnDetails> {
  if (hasValue(params.todoId)) {
    const todo = todoStore.readTodo(params.todoId);
    if (hasNoValue(todo)) {
      return {
        content: [
          {
            type: "text",
            text: `Todo with ID ${params.todoId} not found.`,
          },
        ],
        details: {
          success: false,
          action: "read",
          error: "todo-not-found",
        },
      };
    } else {
      return {
        content: [
          {
            type: "text",
            text: `
                  Todo ${todo.id}: ${todo.title}\n
                  Description: ${todo.description}\n
                  Status: ${todo.status}
                  `,
          },
        ],
        details: {
          success: true,
          action: "read",
          todo,
        },
      };
    }
  } else {
    const todos = todoStore.listTodos();
    if (isEmpty(todos)) {
      return {
        content: [
          {
            type: "text",
            text: `No pending todos found.`,
          },
        ],
        details: {
          success: true,
          action: "read",
          todos: [],
        },
      };
    } else {
      return {
        content: [
          {
            type: "text",
            text: `
                  Pending Todos:\n
                  ${todos.map((t) => `- ${t.id}: ${t.title}`).join("\n")}
                  `,
          },
        ],
        details: {
          success: true,
          action: "read",
          todos,
        },
      };
    }
  }
}
