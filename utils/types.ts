import { SessionEntry } from "@earendil-works/pi-coding-agent";

export interface SimpleSessionPersistenceApi {
  appendEntry: (type: string, entry: unknown) => void;
  getEntries: () => SessionEntry[];
}
