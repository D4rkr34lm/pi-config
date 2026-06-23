import assert from "node:assert/strict";
import test from "node:test";

import {
  formatTodoFooterStatus,
  formatTodoItemsOnlyList,
  formatTodoList,
} from "../extensions/todos.ts";

const todo = (id, brief, status = "open") => ({
  id,
  brief,
  long: `${brief} details`,
  status,
  createdAt: id,
  updatedAt: id,
});

const openTodo = (id) => todo(id, `Open ${id}`);
const completedTodo = (id) => todo(id, `Done ${id}`, "completed");

test("renders empty todo lists with count header", () => {
  assert.equal(formatTodoList([]), "Todos: 0 open / 0 completed");
});

test("renders fewer than five todos below count header", () => {
  assert.equal(
    formatTodoList([completedTodo(1), openTodo(2), openTodo(3)]),
    "Todos: 2 open / 1 completed\n1. #1 [x] Done 1\n2. #2 [ ] Open 2\n3. #3 [ ] Open 3"
  );
});

test("renders up to two completed todos first and fills with open todos", () => {
  assert.equal(
    formatTodoList([
      completedTodo(1),
      completedTodo(2),
      openTodo(3),
      openTodo(4),
      openTodo(5),
      openTodo(6),
    ]),
    "Todos: 4 open / 2 completed\n1. #1 [x] Done 1\n2. #2 [x] Done 2\n3. #3 [ ] Open 3\n4. #4 [ ] Open 4\n5. #5 [ ] Open 5\n+1 more"
  );
});

test("renders before and after markers around the five-todo window", () => {
  assert.equal(
    formatTodoList([
      completedTodo(1),
      completedTodo(2),
      completedTodo(3),
      completedTodo(4),
      openTodo(5),
      openTodo(6),
      openTodo(7),
      openTodo(8),
      openTodo(9),
    ]),
    "Todos: 5 open / 4 completed\n+2 previous\n1. #3 [x] Done 3\n2. #4 [x] Done 4\n3. #5 [ ] Open 5\n4. #6 [ ] Open 6\n5. #7 [ ] Open 7\n+2 more"
  );
});

test("first write exception can display only newly created todos", () => {
  assert.equal(
    formatTodoItemsOnlyList([1, 2, 3, 4, 5, 6].map((id) => openTodo(id))),
    "Todos: 6 open / 0 completed\n1. #1 [ ] Open 1\n2. #2 [ ] Open 2\n3. #3 [ ] Open 3\n4. #4 [ ] Open 4\n5. #5 [ ] Open 5\n6. #6 [ ] Open 6"
  );
});

test("renders empty footer status", () => {
  assert.equal(formatTodoFooterStatus([]), "Todos: 0 Open / 0 Completed");
});

test("renders single-line footer with only open todo titles", () => {
  assert.equal(
    formatTodoFooterStatus([
      completedTodo(1),
      completedTodo(2),
      openTodo(3),
      openTodo(4),
      openTodo(5),
      openTodo(6),
      openTodo(7),
      openTodo(8),
    ]),
    "Todos: 6 Open / 2 Completed | Open 3, Open 4, Open 5, Open 6, Open 7, +1 more"
  );
});
