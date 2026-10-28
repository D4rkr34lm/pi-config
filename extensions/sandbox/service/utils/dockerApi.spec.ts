import { describe, expect, it } from "vitest";
import { useSimpleDockerApi } from "./dockerApi";

describe("Simple docker API", () => {
  const sut = useSimpleDockerApi();

  it("allows for listing images", async () => {
    const images = await sut.listImages();

    expect(images).toBeInstanceOf(Array);
  });

  it("allows for building an image and removing it", async () => {
    const MOCK_TAG = "simple-docker-api-build-test-image:latest";

    const imagesBeforeBuild = await sut.listImages();

    expect(imagesBeforeBuild).not.toContain(MOCK_TAG);

    const MOCK_DOCKERFILE = `FROM alpine:latest
      RUN echo "Hello, World!" > /hello.txt
    `;

    await sut.buildImage({
      dockerfile: MOCK_DOCKERFILE,
      tag: MOCK_TAG,
      context: ".",
    });

    const imagesAfterBuild = await sut.listImages();

    expect(imagesAfterBuild).toContain(MOCK_TAG);

    await sut.removeImage(MOCK_TAG);

    const imagesAfterRemove = await sut.listImages();

    expect(imagesAfterRemove).not.toContain(MOCK_TAG);
  });

  it("allows for running a container and stopping it", async () => {
    const MOCK_TAG = "simple-docker-api-run-test-image:latest";
    const MOCK_CONTAINER_NAME = "simple-docker-api-run-test-container";

    const MOCK_DOCKERFILE = `FROM alpine:latest
      RUN echo "Hello, World!" > /hello.txt
    `;

    await sut.buildImage({
      dockerfile: MOCK_DOCKERFILE,
      tag: MOCK_TAG,
      context: ".",
    });

    const containerId = await sut.runContainer({
      containerName: MOCK_CONTAINER_NAME,
      image: MOCK_TAG,
      env: {},
      volumes: [],
      ports: [],
    });

    expect(containerId).toBeDefined();

    const activeContainers = await sut.listContainers({ all: true });

    expect(activeContainers).toContain(containerId);

    await sut.stopContainer(containerId);

    const activeContainersAfterStop = await sut.listContainers();

    expect(activeContainersAfterStop).not.toContain(containerId);

    await sut.removeContainer(containerId);
    await sut.removeImage(MOCK_TAG);
  });
});
