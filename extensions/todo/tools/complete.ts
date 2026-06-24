import { AgentToolResult } from "@earendil-works/pi-coding-agent";
import Type, { Static } from "typebox";
import { Todo, TodoStore } from "../store";

export const completeTodoSchema = Type.Object({
  action: Type.Literal("complete"),
  todoId: Type.String({
    description: "The ID of the todo to mark as completed",
  }),
});

export type CompleteTodoReturnDetails =
  | {
      success: true;
      todo: Todo;
      action: "complete";
    }
  | {
      success: false;
      action: "complete";
      todoId: string;
      error: string;
    };

export function executeCompleteTodo(
  params: Static<typeof completeTodoSchema>,
  todoStore: TodoStore
): AgentToolResult<CompleteTodoReturnDetails> {
  const result = todoStore.completeTodo(params.todoId);
  if (result.isErr()) {
    return {
      content: [
        {
          type: "text",
          text: `Failed to complete todo ${params.todoId}: ${result.error}`,
        },
      ],
      details: {
        success: false,
        action: "complete",
        todoId: params.todoId,
        error: result.error,
      },
    };
  } else {
    return {
      content: [
        {
          type: "text",
          text: `Todo ${params.todoId} completed.`,
        },
      ],
      details: {
        success: true,
        action: "complete",
        todo: result.value,
      },
    };
  }
}
