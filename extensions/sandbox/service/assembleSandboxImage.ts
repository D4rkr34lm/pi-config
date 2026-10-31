import { SandboxDefinition } from "./defineSandbox";
import {
  ROOT_NVM_DIR,
  SANDBOX_GROUP_ID,
  SANDBOX_RUNTIME_PATH,
  SANDBOX_USER_ID,
  USER_NVM_DIR,
} from "./constants";
import {
  dependencyInstallers,
  installNode,
  installNpm,
  installTsx,
} from "./dependencies";
import { hasValue } from "../../../utils/type-guards";
import { toPairs } from "../../../utils/strict-utils";

const setupRuntime = () => {
  return `
  USER root
  ENV NVM_DIR=${ROOT_NVM_DIR}
  RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.6/install.sh | bash

  ${installNode(ROOT_NVM_DIR)}

  ${installNpm()}
  ${installTsx()}

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

const userSpaceDependencies = (sandboxDefinition: SandboxDefinition) => {
  const dependencies = sandboxDefinition.dependencies;

  const definedDependencies = toPairs(dependencies).filter(([_, version]) =>
    hasValue(version)
  );

  const installationParts = definedDependencies.map(([name, version]) => {
    const computedVersion = version === true ? undefined : version;
    const installer = dependencyInstallers[name];
    return installer(computedVersion);
  });
  return installationParts.join("\n");
};

const setupUserSpace = (sandboxDefinition: SandboxDefinition) => {
  return `
  USER sandbox
  ENV NVM_DIR=${USER_NVM_DIR}
  RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.6/install.sh | bash

  ${userSpaceDependencies(sandboxDefinition)}
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
  // Runtime/bootstrap
  "libatomic1",
  "ca-certificates",
  "curl",
  "bash",

  // Source control and searching
  "git",
  "openssh-client",
  "ripgrep",

  // Python
  "python3",
  "python3-pip",
  "python3-venv",
  "python3-dev",
  "python-is-python3",

  // Native Node/Python package compilation
  "build-essential",
  "pkg-config",

  // Data and file inspection
  "jq",
  "file",

  // Patching and archives
  "patch",
  "diffutils",
  "zip",
  "unzip",
  "xz-utils",

  // Process debugging
  "procps",
  "lsof",
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
