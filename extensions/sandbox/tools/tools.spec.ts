import path from "path";
import { describe, expect, it, vi } from "vitest";
import { every } from "lodash-es";
import { defineSandbox } from "../service/defineSandbox";
import { Sandbox } from "../service/startSandbox";
import { buildSandboxedBashTool } from "./bash";
import { buildSandboxedEditTool } from "./edit";
import { buildSandboxedReadTool } from "./read";
import { buildSandboxedWriteTool } from "./write";

const workspacePath = path.resolve("test-data/sandbox-tool-workspace");

function createSandbox(api: unknown): Sandbox {
  return {
    workspacePath,
    definition: defineSandbox({ name: "tool-test" }),
    authToken: "sandbox-auth-token",
    api: api as Sandbox["api"],
    stop: async () => {},
  };
}

describe("sandboxed tools", () => {
  it("reads workspace files through the authenticated sandbox API", async () => {
    const query = vi.fn().mockResolvedValue({
      type: "success",
      content: Buffer.from("Hello from the sandbox").toString("base64"),
    });
    const tool = buildSandboxedReadTool(
      createSandbox({ fileSystem: { readFile: { query } } })
    );

    const result = await tool.execute("read-call", {
      path: "nested/file.txt",
    });

    expect(query).toHaveBeenCalledWith({
      authToken: "sandbox-auth-token",
      path: "/workspace/nested/file.txt",
      encoding: "base64",
    });
    expect(result.content).toEqual([
      { type: "text", text: "Hello from the sandbox" },
    ]);
  });

  it("surfaces sandbox filesystem failures", async () => {
    const tool = buildSandboxedReadTool(
      createSandbox({
        fileSystem: {
          readFile: {
            query: vi.fn().mockResolvedValue({
              type: "error",
              message: "ACCESS_DENIED",
            }),
          },
        },
      })
    );

    await expect(
      tool.execute("read-call", { path: "private/file.txt" })
    ).rejects.toThrow("Sandbox filesystem operation failed: ACCESS_DENIED");
  });

  it("rejects file paths outside the mounted workspace", async () => {
    const query = vi.fn();
    const tool = buildSandboxedReadTool(
      createSandbox({ fileSystem: { readFile: { query } } })
    );

    await expect(
      tool.execute("read-call", {
        path: path.resolve(workspacePath, "..", "outside.txt"),
      })
    ).rejects.toThrow("is outside of the workspace");
    expect(query).not.toHaveBeenCalled();
  });

  it("creates parent directories and writes through the sandbox API", async () => {
    const mkdir = vi.fn().mockResolvedValue({ type: "success" });
    const writeFile = vi.fn().mockResolvedValue({ type: "success" });
    const tool = buildSandboxedWriteTool(
      createSandbox({
        fileSystem: {
          mkdir: { mutate: mkdir },
          writeFile: { mutate: writeFile },
        },
      })
    );

    await tool.execute("write-call", {
      path: "nested/file.txt",
      content: "New content",
    });

    expect(mkdir).toHaveBeenCalledWith({
      authToken: "sandbox-auth-token",
      path: "/workspace/nested",
    });
    expect(writeFile).toHaveBeenCalledWith({
      authToken: "sandbox-auth-token",
      path: "/workspace/nested/file.txt",
      content: "New content",
    });
  });

  it("edits files through authenticated reads and writes", async () => {
    const readFile = vi.fn().mockResolvedValue({
      type: "success",
      content: "before value after",
    });
    const writeFile = vi.fn().mockResolvedValue({ type: "success" });
    const tool = buildSandboxedEditTool(
      createSandbox({
        fileSystem: {
          readFile: { query: readFile },
          writeFile: { mutate: writeFile },
        },
      })
    );

    await tool.execute("edit-call", {
      path: "file.txt",
      edits: [{ oldText: "value", newText: "updated" }],
    });

    expect(readFile).toHaveBeenCalledWith({
      authToken: "sandbox-auth-token",
      path: "/workspace/file.txt",
    });
    expect(writeFile).toHaveBeenCalledWith({
      authToken: "sandbox-auth-token",
      path: "/workspace/file.txt",
      content: "before updated after",
    });
  });

  it("executes commands with sandbox authentication and a mapped cwd", async () => {
    async function* commandOutput() {
      yield { type: "stdout" as const, data: "command output\n" };
      yield { type: "exit" as const, code: 0 };
    }

    const mutate = vi.fn().mockResolvedValue(commandOutput());
    const tool = buildSandboxedBashTool(
      createSandbox({ shell: { executeCommand: { mutate } } })
    );

    const result = await tool.execute("bash-call", {
      command: "printf 'command output\\n'",
      timeout: 2,
    });

    expect(mutate).toHaveBeenCalledOnce();
    const [input] = mutate.mock.calls[0] ?? [];
    expect(input).toMatchObject({
      authToken: "sandbox-auth-token",
      command: "printf 'command output\\n'",
      cwd: "/workspace",
      timeout: 2,
    });
    expect(
      every(Object.keys(input.env), (name) => name.startsWith("PI_"))
    ).toBe(true);
    expect(result.structuredContent).toMatchObject({
      output: "command output\n",
      exit_code: 0,
    });
  });
});
