import os from "os";
import path from "path";

export const SANDBOX_API_PORT = 3000;
export const SANDBOX_WORKING_DIR = "/workspace";

export const PI_CONFIG_DIR = path.join(os.homedir(), ".pi", "agent");

export const SANDBOXES_CONFIG_FILE = path.join(PI_CONFIG_DIR, "sandboxes.json");
export const SANDBOXES_DIR = path.join(PI_CONFIG_DIR, "sandboxes");
