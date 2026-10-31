import {
  DEFAULT_NODE_VERSION,
  DEFAULT_NPM_VERSION,
  DEFAULT_TSX_VERSION,
  SandboxDefinition,
} from "./defineSandbox";
import {
  SANDBOX_GROUP_ID,
  SANDBOX_RUNTIME_PATH,
  SANDBOX_USER_ID,
} from "./constants";

const USER_NVM_DIR = "/home/sandbox/.nvm";

const installNode = (nodeVersion: string, nvmDir: string) => `
RUN . "${nvmDir}/nvm.sh" && nvm install ${nodeVersion} && nvm use ${nodeVersion} && nvm alias default ${nodeVersion}
ENV PATH="${nvmDir}/versions/node/v${nodeVersion}/bin:$PATH"
`;

const installNpm = (npmVersion: string) => `
RUN npm install -g npm@${npmVersion}
`;

const installTsx = (tsxVersion: string) => `
RUN npm install -g tsx@${tsxVersion}
`;

const ROOT_NVM_DIR = "/root/.nvm";
const setupRuntime = () => {
  return `
  USER root
  ENV NVM_DIR=${ROOT_NVM_DIR}
  RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.6/install.sh | bash

  ${installNode(DEFAULT_NODE_VERSION, ROOT_NVM_DIR)}

  ${installNpm(DEFAULT_NPM_VERSION)}
  ${installTsx(DEFAULT_TSX_VERSION)}

  RUN mkdir ${SANDBOX_RUNTIME_PATH} && chmod 700 ${SANDBOX_RUNTIME_PATH}

  COPY runtime ${SANDBOX_RUNTIME_PATH}
  RUN npm install --prefix ${SANDBOX_RUNTIME_PATH}
  `;
};

const createSandboxUser = () => {
  return `
  USER root
  RUN groupadd --gid ${SANDBOX_GROUP_ID} sandbox && useradd --create-home --shell /bin/bash --uid ${SANDBOX_USER_ID} --gid ${SANDBOX_GROUP_ID} sandbox
`;
};

const setupUserSpace = (sandboxDefinition: SandboxDefinition) => {
  return `
  USER sandbox
  ENV NVM_DIR=${USER_NVM_DIR}
  RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.6/install.sh | bash

  ${installNode(sandboxDefinition.dependencies.node, USER_NVM_DIR)}

  ${installNpm(sandboxDefinition.dependencies.npm)}
  ${installTsx(sandboxDefinition.dependencies.tsx)}
  `;
};

const setupWorkspace = () => {
  return `
  USER root
  RUN mkdir /workspace && chmod 777 /workspace
  
  WORKDIR /workspace
  RUN git config --system --add safe.directory /workspace && git config --system --add safe.directory '/workspace/*'
  `;
};

const SANDBOX_BASE_IMAGE = "debian:bookworm";

const ESSENTIAL_DEPENDENCIES = [
  "libatomic1",
  "ca-certificates",
  "curl",
  "git",
  "bash",
  "ripgrep",
];
export function assembleSandboxDockerFile(
  definition: SandboxDefinition
): string {
  return `
  FROM ${SANDBOX_BASE_IMAGE}

  USER root
  RUN apt-get update && apt-get install -y ${ESSENTIAL_DEPENDENCIES.join(" ")} && rm -rf /var/lib/apt/lists/*

  ${setupRuntime()}

  ${createSandboxUser()}
  ${setupUserSpace(definition)}

  ${setupWorkspace()}
  
  USER root
  CMD tsx ${SANDBOX_RUNTIME_PATH}/server.ts
  `;
}
