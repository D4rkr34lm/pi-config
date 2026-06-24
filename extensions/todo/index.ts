import { AgentToolResult, ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { useTodoStore } from "./store";
import {
  executeWriteTodo,
  WriteTodosReturnDetails,
  writeTodosSchema,
} from "./tools/write";
import {
  executeReadTodo,
  ReadTodosReturnDetails,
  readTodosSchema,
} from "./tools/read";
import {
  CompleteTodoReturnDetails,
  completeTodoSchema,
  executeCompleteTodo,
} from "./tools/complete";
import {
  executeAbortTodo,
  abortTodoSchema,
  AbortTodoReturnDetails,
} from "./tools/abort";

const todoArgsSchema = Type.Union([
  writeTodosSchema,
  readTodosSchema,
  completeTodoSchema,
  abortTodoSchema,
]);

type ToolActionNotFoundReturnDetails = {
  success: false;
  action: "unknown";
};

export type TodoToolReturnDetails =
  | WriteTodosReturnDetails
  | ReadTodosReturnDetails
  | CompleteTodoReturnDetails
  | AbortTodoReturnDetails
  | ToolActionNotFoundReturnDetails;

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "todo",
    label: "Todo",
    description:
      "Read and write to your todo list or mark todos as completed or aborted.",
    parameters: todoArgsSchema,
    execute: async (
      id,
      params,
      signal,
      onUpdate,
      ctx
    ): Promise<AgentToolResult<TodoToolReturnDetails>> => {
      const todoStore = useTodoStore({
        appendEntry: pi.appendEntry.bind(pi),
        getEntries: ctx.sessionManager.getEntries.bind(ctx.sessionManager),
      });

      switch (params.action) {
        case "write":
          return executeWriteTodo(params, todoStore);
        case "read":
          return executeReadTodo(params, todoStore);
        case "complete":
          return executeCompleteTodo(params, todoStore);
        case "abort":
          return executeAbortTodo(params, todoStore);
        default:
          return {
            content: [
              {
                type: "text",
                text: `Unknown action`,
              },
            ],
            details: { action: "unknown", success: false },
          };
      }
    },
  });
}
