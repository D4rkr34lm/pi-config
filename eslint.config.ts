import { defineConfig, globalIgnores } from "eslint/config";

import js from "@eslint/js";
import ts from "typescript-eslint";
import markdown from "@eslint/markdown";
import prettier from "eslint-plugin-prettier/recommended";

export default defineConfig([
  globalIgnores(["node_modules", "dist", "build", "coverage"]),
  js.configs.recommended,
  markdown.configs.recommended,
  ...ts.configs.recommended,
  prettier,
]);
