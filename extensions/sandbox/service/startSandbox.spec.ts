import { assert, beforeAll, beforeEach, describe, expect } from "vitest";
import { defineSandbox, Dependency, SandboxDefinition } from "./defineSandbox";
import { afterEach, it } from "node:test";
import { useSimpleDockerApi } from "./utils/dockerApi";
import { startSandbox } from "./startSandbox";
import fs from "fs";
import path from "path";

const TEST_SANDBOX_NAME = "test-sandbox";
const TEST_SANDBOX_BASE = "debian:bookworm";

const TEST_SANDBOX_DIR = "./test-data/sandbox";

function mockSandboxDefinition({
  dependencies = [],
  forbiddenPaths = [],
  isolatedPaths = [],
  runAfterStart = [],
}: {
  dependencies?: Dependency[];
  forbiddenPaths?: string[];
  isolatedPaths?: string[];
  runAfterStart?: string[];
}) {
  return defineSandbox({
    name: TEST_SANDBOX_NAME,
    base: TEST_SANDBOX_BASE,
    dependencies,
    forbiddenPaths,
    isolatedPaths,
    runAfterStart,
  });
}

describe("start Sandbox", () => {
  async function setupTestSandbox(
    testId: string,
    sandboxDefinition: SandboxDefinition
  ) {
    const dockerApi = useSimpleDockerApi();

    const availableImages = await dockerApi.listImages();
    const containers = await dockerApi.listContainers({
      all: true,
    });

    assert(
      !availableImages.includes(TEST_SANDBOX_BASE),
      `The base image ${TEST_SANDBOX_BASE} should not be available before the test.`
    );
    assert(
      !containers.includes(TEST_SANDBOX_NAME),
      `The container ${TEST_SANDBOX_NAME} should not be running before the test.`
    );

    const sandbox = await startSandbox(sandboxDefinition, TEST_SANDBOX_DIR);

    return {
      sandbox,
      [Symbol.dispose]: async () => {
        await sandbox.stop();
        dockerApi.removeContainer(testId);
        dockerApi.removeImage(sandboxDefinition.name);
      },
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

  it("allows starting a sandbox", async () => {
    using testSetup = await setupTestSandbox(
      "test-start-sandbox",
      mockSandboxDefinition({})
    );

    const sandbox = testSetup.sandbox;

    expect(sandbox.api.getHeartbeat.query()).resolves.toEqual({
      isRunning: true,
    });
  });

  it("allows creating an reading a file in the sandbox", async () => {
    using testSetup = await setupTestSandbox(
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
  });

  it("allows reading a file in the sandbox from the workspace", async () => {
    const filePath = "test-file.txt";
    const fileContent = "Hello from the workspace!";

    using workspaceSetup = setupTestWorkspace([
      {
        path: filePath,
        content: fileContent,
      },
    ]);

    using testSetup = await setupTestSandbox(
      "test-read-workspace-file",
      mockSandboxDefinition({})
    );

    const sandbox = testSetup.sandbox;

    const fileReadResult = await sandbox.api.fileSystem.readFile.query({
      path: filePath,
    });

    expect(fileReadResult).toEqual(fileContent);
  });

  it("allows editing a workspace file in the sandbox", async () => {
    const filePath = "test-file.txt";
    const targetContent = "Updated content from the sandbox!";

    using workspaceSetup = setupTestWorkspace([
      {
        path: "test-file.txt",
        content: "Initial content",
      },
    ]);

    using testSetup = await setupTestSandbox(
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

    const fileContent = fs.readFileSync(path.join(TEST_SANDBOX_DIR, filePath));
    expect(fileContent).toEqual(targetContent);
  });

  it.skip("allows executing bash commands in the sandbox", () => {});

  it.skip("prevents read and write access to forbidden paths", () => {});

  it.skip("isolates access to specified paths", () => {});

  it.skip("installs dependencies from apt", () => {});

  it.skip("installs dependencies from npm", () => {});
});
