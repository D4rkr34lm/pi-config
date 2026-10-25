import { afterAll, describe, expect, it } from "vitest";
import { defineSandbox, SandboxDefinition } from "./defineSandbox";
import { useSimpleDockerApi } from "./utils/dockerApi";
import { startSandbox } from "./startSandbox";
import fs from "fs";
import path from "path";

const TEST_SANDBOX_NAME = "test-sandbox";
const TEST_SANDBOX_IMAGE = `pi-sandbox-${TEST_SANDBOX_NAME}:latest`;

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

function mockSandboxDefinition({
  forbiddenPaths = [],
  isolatedPaths = [],
  runAfterStart = [],
}: {
  forbiddenPaths?: string[];
  isolatedPaths?: string[];
  runAfterStart?: string[];
}) {
  return defineSandbox({
    name: TEST_SANDBOX_NAME,
    forbiddenPaths,
    isolatedPaths,
    runAfterStart,
  });
}

describe("start Sandbox", { concurrent: false }, () => {
  afterAll(async () => {
    const dockerApi = useSimpleDockerApi();
    const images = await dockerApi.listImages();

    if (images.includes(TEST_SANDBOX_IMAGE)) {
      await dockerApi.removeImage(TEST_SANDBOX_IMAGE);
    }
  });

  async function setupTestSandbox(
    testId: string,
    sandboxDefinition: SandboxDefinition
  ) {
    const sandbox = await startSandbox(sandboxDefinition, TEST_SANDBOX_DIR, {
      containerName: testId,
    });

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
        "test-start-sandbox",
        mockSandboxDefinition({})
      );

      const sandbox = testSetup.sandbox;

      await expect(sandbox.api.getHeartbeat.query()).resolves.toEqual({
        isRunning: true,
      });
    },
    TEST_TIMEOUT
  );

  it(
    "allows creating an reading a file in the sandbox",
    async () => {
      await using testSetup = await setupTestSandbox(
        "test-create-file",
        mockSandboxDefinition({})
      );

      const filePath = "/test-file.txt";
      const fileContent = "Hello, Sandbox!";

      const sandbox = testSetup.sandbox;

      const fileWriteResult = await sandbox.api.fileSystem.writeFile.mutate({
        path: filePath,
        content: fileContent,
      });

      expect(fileWriteResult).toEqual({
        success: true,
      });

      const fileReadResult = await sandbox.api.fileSystem.readFile.query({
        path: filePath,
      });

      expect(fileReadResult).toEqual(fileContent);
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
        "test-read-workspace-file",
        mockSandboxDefinition({})
      );

      const sandbox = testSetup.sandbox;

      const fileReadResult = await sandbox.api.fileSystem.readFile.query({
        path: filePath,
      });

      expect(fileReadResult).toEqual(fileContent);
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
        "test-edit-file",
        mockSandboxDefinition({})
      );

      const sandbox = testSetup.sandbox;

      const fileWriteResult = await sandbox.api.fileSystem.writeFile.mutate({
        path: filePath,
        content: targetContent,
      });

      expect(fileWriteResult).toEqual({
        success: true,
      });

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
        "test-bash-command",
        mockSandboxDefinition({})
      );

      const sandbox = testSetup.sandbox;

      const bashResult = await sandbox.api.shell.executeCommand.mutate({
        command: "bash test-script.sh",
      });

      const { stdout, stderr, exitCode } = await collectShellStream(bashResult);

      expect(stdout.trim()).toEqual("Hello, World!");
      expect(stderr.trim()).toEqual("");
      expect(exitCode).toBe(0);
    },
    TEST_TIMEOUT
  );

  it(
    "prevents read & write access to forbidden paths",
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
        "test-forbidden-read",
        mockSandboxDefinition({
          forbiddenPaths: [FORBIDDEN_READ_FILE_PATH, FORBIDDEN_WRITE_FILE_PATH],
        })
      );

      const sandbox = testSetup.sandbox;

      const fileReadPromise = sandbox.api.fileSystem.readFile.query({
        path: FORBIDDEN_READ_FILE_PATH,
      });

      const fileWritePromise = sandbox.api.fileSystem.writeFile.mutate({
        path: FORBIDDEN_WRITE_FILE_PATH,
        content: "Trying to write to a forbidden file.",
      });

      await expect(fileReadPromise).rejects.toThrow();
      await expect(fileWritePromise).rejects.toThrow();

      const fileContent = fs.readFileSync(
        path.join(TEST_SANDBOX_DIR, FORBIDDEN_WRITE_FILE_PATH),
        "utf8"
      );
      expect(fileContent).toEqual(FORBIDDEN_WRITE_FILE_CONTENT);
    },
    TEST_TIMEOUT
  );

  it.skip(
    "prevents executing commands in forbidden paths",
    () => {},
    TEST_TIMEOUT
  );

  it.skip("isolates access to specified paths", () => {});
});
