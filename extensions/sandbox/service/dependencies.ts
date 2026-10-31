import { USER_NVM_DIR } from "./constants";
import { DependencyName } from "./defineSandbox";

export const installNode = (
  nvmDir: string,
  nodeVersion: string = "26.12.1"
) => `
RUN . "${nvmDir}/nvm.sh" && nvm install ${nodeVersion} && nvm use ${nodeVersion} && nvm alias default ${nodeVersion}
ENV PATH="${nvmDir}/versions/node/v${nodeVersion}/bin:$PATH"
`;

export const installNpm = (npmVersion: string = "12") => `
RUN npm install -g npm@${npmVersion}
`;

export const installTsx = (tsxVersion: string = "4.20.6") => `
RUN npm install -g tsx@${tsxVersion}
`;

const installBun = (bunVersion: string = "1.4.4") => `
RUN curl -fsSL https://bun.com/install | bash -s "bun-v${bunVersion}"
ENV PATH="/home/sandbox/.bun/bin:$PATH"
`;

export const dependencyInstallers: {
  [key in DependencyName]: (version?: string) => string;
} = {
  node: (version) => installNode(USER_NVM_DIR, version),
  npm: installNpm,
  tsx: installTsx,
  bun: installBun,
};
