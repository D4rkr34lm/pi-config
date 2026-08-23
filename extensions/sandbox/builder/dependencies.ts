import { Dependency } from "./buildSandbox";

export const node = (args?: {
  npmVersion: string;
  nodeVersion: string;
}): Dependency[] => {
  const { npmVersion, nodeVersion } = args ?? {
    npmVersion: "9.8.1",
    nodeVersion: "20.5.0",
  };
  return [
    {
      origin: "apt",
      name: "node",
      version: nodeVersion,
    },
    {
      origin: "apt",
      name: "npm",
      version: npmVersion,
    },
  ];
};

export const ripGrep = (): Dependency => ({
  origin: "apt",
  name: "ripgrep",
  version: "14.0.0",
});

export const git = (): Dependency => ({
  origin: "apt",
  name: "git",
  version: "2.42.0",
});

export const bash = (): Dependency => ({
  origin: "apt",
  name: "bash",
  version: "5.3.2",
});

export const curl = (): Dependency => ({
  origin: "apt",
  name: "curl",
  version: "8.3.1",
});

export const python = (args?: {
  pythonVersion: string;
  pipVersion: string;
  condaVersion: string;
}): Dependency[] => {
  const { pythonVersion, pipVersion, condaVersion } = args ?? {
    pythonVersion: "3.12.2",
    pipVersion: "23.3.1",
    condaVersion: "23.11.0",
  };
  return [
    {
      origin: "apt",
      name: "python",
      version: pythonVersion,
    },
    {
      origin: "apt",
      name: "pip",
      version: pipVersion,
    },
    {
      origin: "apt",
      name: "conda",
      version: condaVersion,
    },
  ];
};

export const tsx = (): Dependency => ({
  origin: "npm",
  name: "tsx",
  version: "3.12.7",
});
