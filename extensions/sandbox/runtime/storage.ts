interface Storage {
  isSetup: boolean;
  authToken: string;
  forbiddenGlobs: string[];
}

const authToken = process.env.SANDBOX_AUTH_TOKEN ?? "";

if (!authToken) {
  throw new Error("SANDBOX_AUTH_TOKEN environment variable is not set");
}

export const storage: Storage = {
  isSetup: false,
  authToken: authToken,
  forbiddenGlobs: [],
};
