import path from "path";
import z from "zod";
import fs from "fs"

const storageSchema = z.object({
  isSetup: z.boolean(),
  authToken: z.string(),
  forbiddenGlobs: z.array(z.string()),
});

type Storage = z.infer<typeof storageSchema>;

const storagePersistencePath = path.join(
  "runtime", "storage.json"
)


const defaultStorage = (authToken: string): Storage => ({
  isSetup: false,
  authToken: authToken,
  forbiddenGlobs: [],
});

function loadStorage() {
  const authToken = process.env.SANDBOX_AUTH_TOKEN;
  if (!authToken) {
    throw new Error("SANDBOX_AUTH_TOKEN environment variable is not set.");
  }

  if(!fs.existsSync(storagePersistencePath)) {
    return defaultStorage(authToken);
  }
  const data = fs.readFileSync(storagePersistencePath, "utf-8");
  const parsed = JSON.parse(data);
  const result = storageSchema.safeParse(parsed);
  if (!result.success) {
    console.error("Failed to load storage:", result.error);
    return defaultStorage(authToken);
  }
  return result.data;
}



export function setupStorage({ forbiddenGlobs }: { forbiddenGlobs: string[] }) {
  storage.isSetup = true;
  storage.forbiddenGlobs = forbiddenGlobs;

  fs.writeFileSync(storagePersistencePath, JSON.stringify(storage, null, 2), "utf-8");
}

export const storage: Storage = loadStorage();