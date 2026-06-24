import Type, { Static } from "typebox";
import { SimpleSessionPersistenceApi } from "../../utils/types";
import { useTodoRepository } from "./repository";
import { last } from "lodash-es";
import { uid } from "uid";
import { err, ok, Result } from "neverthrow";
import { hasNoValue } from "../../utils/type-guards";

export const todoStatusSchema = Type.Union([
  Type.Literal("pending"),
  Type.Literal("completed"),
  Type.Literal("aborted"),
]);
export type TodoStatus = Static<typeof todoStatusSchema>;

export const todoSchema = Type.Object({
  id: Type.String(),
  listId: Type.String(),
  title: Type.String(),
  description: Type.String(),
  abortJustification: Type.Optional(Type.String()),
  status: todoStatusSchema,
});
export type Todo = Static<typeof todoSchema>;

export type TodoChangeError =
  | "todo-not-found"
  | "todo-already-completed"
  | "todo-already-aborted";

export function useTodoStore(api: SimpleSessionPersistenceApi) {
  const { writeTodo, readTodos } = useTodoRepository(api);

  function listTodos(): Todo[] {
    return readTodos().filter((t) => t.status === "pending");
  }

  function readTodo(todoId: string): Todo | null {
    const todos = readTodos();
    const todo = todos.find((t) => t.id === todoId);
    return todo ?? null;
  }

  function createTodo(args: { title: string; description: string }): Todo {
    const openList = readTodos().filter((t) => t.status === "pending");
    const lastTodoOfOpenList = last(openList);

    const newTodo: Todo = {
      id: uid(),
      listId: lastTodoOfOpenList ? lastTodoOfOpenList.listId : uid(),
      title: args.title,
      description: args.description,
      status: "pending",
    };

    writeTodo(newTodo);
    return newTodo;
  }

  function canUpdateTodo(todoId: string): Result<Todo, TodoChangeError> {
    const todo = readTodo(todoId);

    if (hasNoValue(todo)) {
      return err("todo-not-found");
    } else if (todo.status === "completed") {
      return err("todo-already-completed");
    } else if (todo.status === "aborted") {
      return err("todo-already-aborted");
    }

    return ok(todo);
  }

  function updateTodo(
    todoId: string,
    update: {
      title: string;
      description: string;
    }
  ): Result<Todo, TodoChangeError> {
    const canUpdateResult = canUpdateTodo(todoId);
    if (canUpdateResult.isErr()) {
      return err(canUpdateResult.error);
    }

    const todo = canUpdateResult.value;
    const updatedTodo: Todo = {
      ...todo,
      title: update.title,
      description: update.description,
    };

    writeTodo(updatedTodo);
    return ok(updatedTodo);
  }

  function completeTodo(todoId: string): Result<Todo, TodoChangeError> {
    const canUpdateResult = canUpdateTodo(todoId);
    if (canUpdateResult.isErr()) {
      return err(canUpdateResult.error);
    }

    const todo = canUpdateResult.value;
    const completedTodo: Todo = {
      ...todo,
      status: "completed",
    };

    writeTodo(completedTodo);
    return ok(completedTodo);
  }

  function abortTodo(
    todoId: string,
    justification: string
  ): Result<Todo, TodoChangeError> {
    const canUpdateResult = canUpdateTodo(todoId);
    if (canUpdateResult.isErr()) {
      return err(canUpdateResult.error);
    }

    const todo = canUpdateResult.value;
    const abortedTodo: Todo = {
      ...todo,
      status: "aborted",
      abortJustification: justification,
    };

    writeTodo(abortedTodo);
    return ok(abortedTodo);
  }

  return {
    listTodos,
    readTodo,
    createTodo,
    updateTodo,
    completeTodo,
    abortTodo,
    canUpdateTodo,
  };
}

export type TodoStore = ReturnType<typeof useTodoStore>;
