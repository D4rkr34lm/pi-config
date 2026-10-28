import { afterAll, describe, expect, it } from "vitest";
import { defineSandbox, SandboxDefinition } from "./defineSandbox";
import { useSimpleDockerApi } from "./utils/dockerApi";
import { startSandbox } from "./startSandbox";
import fs from "fs";
import path from "path";

const TEST_SANDBOX_DIR = "./test-data/sandbox";

const TEST_TIMEOUT = 60 * 1000; // 60 seconds

async function collectShellStream(
  stream: AsyncIterable<
    | { type: "stdout" | "stderr"; data: string }
    | { type: "exit"; code: number | null }
  >
): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number | null;
}> {
  let stdout = "";
  let stderr = "";
  let exitCode: number | null = null;

  for await (const chunk of stream) {
    if (chunk.type === "stdout") {
      stdout += chunk.data;
    } else if (chunk.type === "stderr") {
      stderr += chunk.data;
    } else if (chunk.type === "exit") {
      exitCode = chunk.code;
      break;
    }
  }

  return { stdout, stderr, exitCode };
}

describe("start Sandbox", { concurrent: false }, () => {
  const testImages = new Set<string>();

  afterAll(async () => {
    const dockerApi = useSimpleDockerApi();
    const images = await dockerApi.listImages();

    await images
      .filter((image) => testImages.has(image))
      .reduce(async (previousRemoval, image) => {
        await previousRemoval;
        await dockerApi.removeImage(image);
      }, Promise.resolve());
  });

  async function setupTestSandbox(sandboxDefinition: SandboxDefinition) {
    testImages.add(`pi-sandbox-${sandboxDefinition.name}:latest`);
    const sandbox = await startSandbox(sandboxDefinition, TEST_SANDBOX_DIR);

    return {
      sandbox,
      [Symbol.asyncDispose]: () => sandbox.stop(),
    };
  }

  function setupTestWorkspace(files: { path: string; content: string }[]) {
    files.forEach((file) => {
      const fullPath = path.join(TEST_SANDBOX_DIR, file.path);
      const dir = path.dirname(fullPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fullPath, file.content);
    });

    return {
      [Symbol.dispose]: () => {
        files.forEach((file) => {
          const fullPath = path.join(TEST_SANDBOX_DIR, file.path);
          if (fs.existsSync(fullPath)) {
            fs.rmSync(fullPath, { recursive: true });
          }
        });
      },
    };
  }

  it(
    "allows starting a sandbox",
    async () => {
      await using testSetup = await setupTestSandbox(
        defineSandbox({ name: "test-start-sandbox" })
      );

      const sandbox = testSetup.sandbox;

      await expect(sandbox.api.admin.isAvailable.query()).resolves.toEqual({
        isAvailable: true,
      });
    },
    TEST_TIMEOUT
  );

  it(
    "rejects invalid authentication for filesystem, shell, and admin operations",
    async () => {
      using _workspaceSetup = setupTestWorkspace([
        { path: "auth-test.txt", content: "Original content" },
      ]);

      await using testSetup = await setupTestSandbox(
        defineSandbox({ name: "test-authentication" })
      );
      const sandbox = testSetup.sandbox;
      const authToken = `${sandbox.authToken}-invalid`;

      await Promise.all(
        [
          sandbox.api.fileSystem.readFile.query({
            path: "auth-test.txt",
            authToken,
          }),
          sandbox.api.fileSystem.writeFile.mutate({
            path: "auth-test.txt",
            content: "Unauthorized write",
            authToken,
          }),
          sandbox.api.fileSystem.mkdir.mutate({
            path: "unauthorized-directory",
            authToken,
          }),
          sandbox.api.shell.executeCommand.mutate({
            command: "printf 'Unauthorized command' > auth-test.txt",
            authToken,
          }),
          sandbox.api.admin.setup.mutate({ forbiddenGlobs: [], authToken }),
        ].map((result) =>
          expect(result).rejects.toMatchObject({
            data: { code: "UNAUTHORIZED" },
          })
        )
      );

      expect(
        fs.readFileSync(path.join(TEST_SANDBOX_DIR, "auth-test.txt"), "utf8")
      ).toBe("Original content");
      expect(
        fs.existsSync(path.join(TEST_SANDBOX_DIR, "unauthorized-directory"))
      ).toBe(false);
    },
    TEST_TIMEOUT
  );

  it(
    "allows creating a directory and writing and reading a file in the sandbox",
    async () => {
      await using testSetup = await setupTestSandbox(
        defineSandbox({ name: "test-create-file" })
      );

      const filePath = "/test-directory/test-file.txt";
      const fileContent = "Hello, Sandbox!";

      const sandbox = testSetup.sandbox;

      await expect(
        sandbox.api.fileSystem.mkdir.mutate({
          path: "/test-directory",
          authToken: sandbox.authToken,
        })
      ).resolves.toEqual({ type: "success" });

      const fileWriteResult = await sandbox.api.fileSystem.writeFile.mutate({
        path: filePath,
        content: fileContent,
        authToken: sandbox.authToken,
      });

      expect(fileWriteResult).toEqual({ type: "success" });

      const fileReadResult = await sandbox.api.fileSystem.readFile.query({
        path: filePath,
        authToken: sandbox.authToken,
      });

      expect(fileReadResult).toEqual({ type: "success", content: fileContent });
    },
    TEST_TIMEOUT
  );

  it(
    "allows reading a file in the sandbox from the workspace",
    async () => {
      const filePath = "test-file.txt";
      const fileContent = "Hello from the workspace!";

      using _workspaceSetup = setupTestWorkspace([
        {
          path: filePath,
          content: fileContent,
        },
      ]);

      await using testSetup = await setupTestSandbox(
        defineSandbox({ name: "test-read-workspace-file" })
      );

      const sandbox = testSetup.sandbox;

      const fileReadResult = await sandbox.api.fileSystem.readFile.query({
        path: filePath,
        authToken: sandbox.authToken,
      });

      expect(fileReadResult).toEqual({ type: "success", content: fileContent });
    },
    TEST_TIMEOUT
  );

  it(
    "allows editing a workspace file in the sandbox",
    async () => {
      const filePath = "test-file.txt";
      const targetContent = "Updated content from the sandbox!";

      using _workspaceSetup = setupTestWorkspace([
        {
          path: "test-file.txt",
          content: "Initial content",
        },
      ]);

      await using testSetup = await setupTestSandbox(
        defineSandbox({ name: "test-edit-file" })
      );

      const sandbox = testSetup.sandbox;

      const fileWriteResult = await sandbox.api.fileSystem.writeFile.mutate({
        path: filePath,
        content: targetContent,
        authToken: sandbox.authToken,
      });

      expect(fileWriteResult).toEqual({ type: "success" });

      const fileContent = fs.readFileSync(
        path.join(TEST_SANDBOX_DIR, filePath),
        "utf8"
      );
      expect(fileContent).toEqual(targetContent);
    },
    TEST_TIMEOUT
  );

  it(
    "allows executing bash commands in the sandbox",
    async () => {
      using _workspaceSetup = setupTestWorkspace([
        {
          path: "test-script.sh",
          content: "#!/bin/bash\necho 'Hello, World!'",
        },
      ]);

      await using testSetup = await setupTestSandbox(
        defineSandbox({ name: "test-bash-command" })
      );

      const sandbox = testSetup.sandbox;

      const bashResult = await sandbox.api.shell.executeCommand.mutate({
        command: "bash test-script.sh",
        authToken: sandbox.authToken,
      });

      const { stdout, stderr, exitCode } = await collectShellStream(bashResult);

      expect(stdout.trim()).toEqual("Hello, World!");
      expect(stderr.trim()).toEqual("");
      expect(exitCode).toBe(0);
    },
    TEST_TIMEOUT
  );

  it(
    "prevents reading, writing, and creating forbidden paths",
    async () => {
      const FORBIDDEN_READ_FILE_PATH = "forbidden-file.txt";

      const FORBIDDEN_WRITE_FILE_PATH = "forbidden-write-file.txt";
      const FORBIDDEN_WRITE_FILE_CONTENT = "This file should not be writable.";

      using _workspaceSetup = setupTestWorkspace([
        {
          path: FORBIDDEN_READ_FILE_PATH,
          content: "This file should not be accessible.",
        },
        {
          path: FORBIDDEN_WRITE_FILE_PATH,
          content: FORBIDDEN_WRITE_FILE_CONTENT,
        },
      ]);

      await using testSetup = await setupTestSandbox(
        defineSandbox({
          name: "test-forbidden-read",
          forbiddenPaths: [
            FORBIDDEN_READ_FILE_PATH,
            FORBIDDEN_WRITE_FILE_PATH,
            "forbidden-directory",
          ],
        })
      );

      const sandbox = testSetup.sandbox;

      const fileReadPromise = sandbox.api.fileSystem.readFile.query({
        path: `/workspace/${FORBIDDEN_READ_FILE_PATH}`,
        authToken: sandbox.authToken,
      });

      const fileWritePromise = sandbox.api.fileSystem.writeFile.mutate({
        path: `/workspace/${FORBIDDEN_WRITE_FILE_PATH}`,
        content: "Trying to write to a forbidden file.",
        authToken: sandbox.authToken,
      });

      const mkdirPromise = sandbox.api.fileSystem.mkdir.mutate({
        path: "/workspace/forbidden-directory",
        authToken: sandbox.authToken,
      });

      await Promise.all(
        [fileReadPromise, fileWritePromise, mkdirPromise].map((result) =>
          expect(result).resolves.toEqual({
            type: "error",
            message: "ACCESS_DENIED",
          })
        )
      );

      const fileContent = fs.readFileSync(
        path.join(TEST_SANDBOX_DIR, FORBIDDEN_WRITE_FILE_PATH),
        "utf8"
      );
      expect(fileContent).toEqual(FORBIDDEN_WRITE_FILE_CONTENT);
      expect(
        fs.existsSync(path.join(TEST_SANDBOX_DIR, "forbidden-directory"))
      ).toBe(false);
    },
    TEST_TIMEOUT
  );

  it(
    "prevents executing commands in forbidden paths",
    async () => {
      using _workspaceSetup = setupTestWorkspace([
        {
          path: "forbidden-command.sh",
          content: "#!/bin/bash\necho 'This command should not be executable.'",
        },
      ]);

      await using testSetup = await setupTestSandbox(
        defineSandbox({
          name: "test-forbidden-command",
          forbiddenPaths: ["forbidden-command.sh"],
        })
      );

      const sandbox = testSetup.sandbox;

      const bashResult = await sandbox.api.shell.executeCommand.mutate({
        command: "bash forbidden-command.sh",
        authToken: sandbox.authToken,
      });

      const { stdout, stderr, exitCode } = await collectShellStream(bashResult);

      expect(stdout.trim()).toEqual("");
      expect(stderr.trim()).toContain("Permission denied");
      expect(exitCode).not.toBeNull();
      expect(exitCode).not.toBe(0);
    },
    TEST_TIMEOUT
  );

  it(
    "allows declaring sandbox private paths",
    async () => {
      const workspacePrivateFileContent = "This is a private file.";
      const containerPrivateFileContent =
        "This is a private file inside the container.";

      using _workspaceSetup = setupTestWorkspace([
        {
          path: "private/test.txt",
          content: workspacePrivateFileContent,
        },
      ]);

      await using testSetup = await setupTestSandbox(
        defineSandbox({
          name: "test-private-paths",
          privatePaths: ["/workspace/private"],
        })
      );

      const sandbox = testSetup.sandbox;

      await expect(
        sandbox.api.fileSystem.readFile.query({
          path: "/workspace/private/test.txt",
          authToken: sandbox.authToken,
        })
      ).resolves.toEqual({ type: "error", message: "FILE_NOT_FOUND" });

      await expect(
        sandbox.api.fileSystem.writeFile.mutate({
          path: "/workspace/private/test.txt",
          content: containerPrivateFileContent,
          authToken: sandbox.authToken,
        })
      ).resolves.toEqual({ type: "success" });

      const sandboxFileReadResult = await sandbox.api.fileSystem.readFile.query(
        {
          path: "/workspace/private/test.txt",
          authToken: sandbox.authToken,
        }
      );

      const fileContentInWorkspace = fs.readFileSync(
        path.join(TEST_SANDBOX_DIR, "private/test.txt"),
        "utf8"
      );

      expect(fileContentInWorkspace).toEqual(workspacePrivateFileContent);

      expect(sandboxFileReadResult).toEqual({
        type: "success",
        content: containerPrivateFileContent,
      });
    },
    TEST_TIMEOUT
  );

  it(
    "prevents manipulating the runtime",
    async () => {
      await using testSetup = await setupTestSandbox(
        defineSandbox({ name: "test-runtime-manipulation" })
      );

      const sandbox = testSetup.sandbox;

      const readRuntimeResult = await sandbox.api.fileSystem.readFile.query({
        path: "/runtime/server.ts",
        authToken: sandbox.authToken,
      });

      expect(readRuntimeResult).toEqual({
        type: "error",
        message: "ACCESS_DENIED",
      });

      const writeRuntimeResult = await sandbox.api.fileSystem.writeFile.mutate({
        path: "/runtime/server.ts",
        content: "console.log('Malicious code');",
        authToken: sandbox.authToken,
      });

      expect(writeRuntimeResult).toEqual({
        type: "error",
        message: "ACCESS_DENIED",
      });

      const commandRuntimeResult =
        await sandbox.api.shell.executeCommand.mutate({
          command: "echo 'Malicious command' > /runtime/malicious.txt",
          authToken: sandbox.authToken,
        });

      const { stdout, stderr, exitCode } =
        await collectShellStream(commandRuntimeResult);

      expect(stdout.trim()).toEqual("");
      expect(stderr.trim()).toContain("Permission denied");
      expect(exitCode).not.toBeNull();
      expect(exitCode).not.toBe(0);
    },
    TEST_TIMEOUT
  );
});
