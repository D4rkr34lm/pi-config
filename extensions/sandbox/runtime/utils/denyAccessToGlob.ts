import fs from "fs/promises";

const OWNER_ONLY_ACCESS_BYTE = 0o700;
export async function denyAccessToGlob(glob: string): Promise<void> {
  for await (const path of fs.glob(glob)) {
    await fs.chmod(path, OWNER_ONLY_ACCESS_BYTE);
  }
}
