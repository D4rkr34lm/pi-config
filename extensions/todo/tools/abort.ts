import Type, { Static } from "typebox";
import { Todo, TodoChangeError, TodoStore } from "../store";
import { AgentToolResult } from "@earendil-works/pi-coding-agent";

export const abortTodoSchema = Type.Object({
  action: Type.Literal("abort"),
  todoId: Type.String({ description: "The ID of the todo to mark as aborted" }),
  justification: Type.String({
    description: "Brief explanation of why the todo is being aborted",
  }),
});

export type AbortTodoReturnDetails =
  | {
      success: false;
      action: "abort";
      todoId: string;
      error: TodoChangeError;
    }
  | {
      success: true;
      action: "abort";
      todo: Todo;
    };

export function executeAbortTodo(
  params: Static<typeof abortTodoSchema>,
  todoStore: TodoStore
): AgentToolResult<AbortTodoReturnDetails> {
  const result = todoStore.abortTodo(params.todoId, params.justification);
  if (result.isErr()) {
    return {
      content: [
        {
          type: "text",
          text: `Failed to abort todo ${params.todoId}: ${result.error}`,
        },
      ],
      details: {
        success: false,
        action: params.action,
        todoId: params.todoId,
        error: result.error,
      },
    };
  } else {
    const abortedTodo = result.value;

    return {
      content: [
        {
          type: "text",
          text: `Todo ${params.todoId} aborted`,
        },
      ],
      details: {
        success: true,
        action: "abort",
        todo: abortedTodo,
      },
    };
  }
}
