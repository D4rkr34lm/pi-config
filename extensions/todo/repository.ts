import { Parse } from "typebox/value";
import { SimpleSessionPersistenceApi } from "../../utils/types";
import { Todo, todoSchema } from "./store";
import { hasValue } from "../../utils/type-guards";

export function useTodoRepository(api: SimpleSessionPersistenceApi) {
  function writeTodo(todo: Todo) {
    api.appendEntry("todo", todo);
  }

  function readTodos(): Todo[] {
    const todos = api
      .getEntries()
      .map((entry) => {
        if (entry.type === "custom" && entry.customType === "todo") {
          const rawData = entry.data;
          return Parse(todoSchema, rawData);
        }
        return null;
      })
      .filter(hasValue);

    return todos;
  }

  return {
    writeTodo,
    readTodos,
  };
}
