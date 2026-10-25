import { SandboxDefinition } from "./defineSandbox";
import { VolumeMount } from "./utils/dockerApi";
import { SANDBOX_USER_ID } from "./constants";

const SANDBOX_BASE_IMAGE = "debian:bookworm";
const ESSENTIAL_DEPENDENCIES = `libatomic1 ca-certificates curl git bash ripgrep`;
const NVM_DIR = "/root/.nvm";

const installNode = (nodeVersion: string) => `
RUN . "${NVM_DIR}/nvm.sh" && nvm install ${nodeVersion} && nvm use ${nodeVersion} && nvm alias default ${nodeVersion}
ENV PATH="${NVM_DIR}/versions/node/v${nodeVersion}/bin:$PATH"
`;

const installNpm = (npmVersion: string) => `
RUN npm install -g npm@${npmVersion}
`;

const installTsx = (tsxVersion: string) => `
RUN npm install -g tsx@${tsxVersion}
`;

export function assembleSandboxDockerFile(
  definition: SandboxDefinition
): string {
  return `
  FROM ${SANDBOX_BASE_IMAGE}

  RUN apt-get update && apt-get install -y ${ESSENTIAL_DEPENDENCIES} && rm -rf /var/lib/apt/lists/*

  ENV NVM_DIR=${NVM_DIR}
  RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.6/install.sh | bash

  ${installNode(definition.dependencies.node)}

  ${installNpm(definition.dependencies.npm)}
  ${installTsx(definition.dependencies.tsx)}

  RUN mkdir /workspace && chmod 777 /workspace
  RUN mkdir /runtime && chmod 700 /runtime

  RUN useradd --shell /bin/bash --uid ${SANDBOX_USER_ID} sandbox

  COPY runtime /runtime
  RUN npm install --prefix /runtime

  WORKDIR /workspace

  CMD tsx /runtime/server.ts
  `;
}

export function assembleIsolationVolumeMounts(
  sandboxDefinition: SandboxDefinition
): VolumeMount[] {
  return sandboxDefinition.isolatedPaths.map((path) => ({
    source: path,
    target: path,
  }));
}
