import { ExtensionAPI } from "@earendil-works/pi-coding-agent";
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
import { renderWriteTodoCall, renderWriteTodoResult } from "./rendering/write";
import { renderReadTodoCall, renderReadTodoResult } from "./rendering/read";
import {
  renderCompleteTodoCall,
  renderCompleteTodoResult,
} from "./rendering/complete";
import { renderAbortTodoCall, renderAbortTodoResult } from "./rendering/abort";

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
  pi.registerTool<typeof todoArgsSchema, TodoToolReturnDetails>({
    name: "todo",
    label: "Todo",
    description:
      "Read and write to your todo list or mark todos as completed or aborted.",
    parameters: todoArgsSchema,
    renderCall: (args, theme, context) => {
      switch (args.action) {
        case "write":
          return renderWriteTodoCall(args, theme, context);
        case "read":
          return renderReadTodoCall(args, theme, context);
        case "complete":
          return renderCompleteTodoCall(args, theme, context);
        case "abort":
          return renderAbortTodoCall(args, theme, context);
        default:
          throw new Error(
            `No renderCall implementation for action ${(args as { action: string }).action}`
          );
      }
    },
    renderResult: (result, _, theme, context) => {
      const details = result.details;
      switch (details.action) {
        case "write":
          return renderWriteTodoResult(details, theme, context);
        case "read":
          return renderReadTodoResult(details, theme, context);
        case "complete":
          return renderCompleteTodoResult(details, theme, context);
        case "abort":
          return renderAbortTodoResult(details, theme, context);
        default:
          throw new Error(
            `No renderResult implementation for action ${(details as { action: string }).action}`
          );
      }
    },
    execute: async (id, params, signal, onUpdate, ctx) => {
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
