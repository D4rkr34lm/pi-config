import z from "zod";
import fs from "fs";
import { SANDBOXES_CACHE_FILE } from "../constants";

const sandboxesCacheSchema = z.record(
  z.string(),
  z.object({
    containerId: z.string(),
    sandboxPort: z.number(),
    authToken: z.string(),
  }),
);

type SandboxesCacheData = z.infer<typeof sandboxesCacheSchema>;

export class SandboxesCache {
  private cache: SandboxesCacheData;

  public static load(): SandboxesCache {
    if (!fs.existsSync(SANDBOXES_CACHE_FILE)) {
      fs.writeFileSync(SANDBOXES_CACHE_FILE, JSON.stringify({}), "utf-8");
    }

    const cacheContent = fs.readFileSync(SANDBOXES_CACHE_FILE, "utf-8");
    const parseResult = sandboxesCacheSchema.safeParse(
      JSON.parse(cacheContent),
    );

    if (!parseResult.success) {
      throw new Error(`Invalid sandboxes cache: ${parseResult.error.message}`);
    } else {
      return new SandboxesCache(parseResult.data);
    }
  }

  private constructor(cache: SandboxesCacheData) {
    this.cache = cache;
  }

  public get(id: string) {
    return this.cache[id] ?? null;
  }

  public set(args: {
    id: string;
    containerId: string;
    sandboxPort: number;
    authToken: string;
  }) {
    this.cache[args.id] = {
      containerId: args.containerId,
      sandboxPort: args.sandboxPort,
      authToken: args.authToken,
    };
    this.save();
  }

  private save() {
    fs.writeFileSync(
      SANDBOXES_CACHE_FILE,
      JSON.stringify(this.cache, null, 2),
      "utf-8",
    );
  }
}
