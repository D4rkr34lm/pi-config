import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const COMMAND_NAME = "usage";

type UsageCost = {
  input?: number;
  output?: number;
  cacheRead?: number;
  total?: number;
};

type Usage = {
  input?: number;
  output?: number;
  cacheRead?: number;
  totalTokens?: number;
  cost?: UsageCost;
};

type MessageUsage = {
  provider: string;
  model: string;
  usage: Usage;
};

type Totals = {
  messages: number;
  input: number;
  output: number;
  cacheRead: number;
  totalTokens: number;
  costInput: number;
  costOutput: number;
  costCacheRead: number;
  costTotal: number;
};

type ScanResult = {
  sessionDir: string;
  sessionTreesScanned: number;
  messageUsages: MessageUsage[];
};

const emptyTotals = (): Totals => ({
  messages: 0,
  input: 0,
  output: 0,
  cacheRead: 0,
  totalTokens: 0,
  costInput: 0,
  costOutput: 0,
  costCacheRead: 0,
  costTotal: 0,
});

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asNumber = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const asString = (value: unknown, fallback: string): string =>
  typeof value === "string" && value.length > 0 ? value : fallback;

const getDefaultSessionDir = (): string => {
  const explicitSessionDir = process.env.PI_CODING_AGENT_SESSION_DIR;
  if (explicitSessionDir) return explicitSessionDir;

  const agentDir =
    process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");
  return join(agentDir, "sessions");
};

const findSessionTreeFiles = async (dir: string): Promise<string[]> => {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const nested = await Promise.all(
    entries.map(async (entry): Promise<string[]> => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return findSessionTreeFiles(path);
      if (entry.isFile() && entry.name.endsWith(".jsonl")) return [path];
      return [];
    })
  );

  return nested.flat();
};

const extractMessageUsage = (line: string): MessageUsage | undefined => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return undefined;
  }

  if (!isObject(parsed) || parsed.type !== "message") return undefined;

  const message = parsed.message;
  if (!isObject(message)) return undefined;

  const usage = message.usage;
  if (!isObject(usage)) return undefined;

  const cost = isObject(usage.cost) ? usage.cost : undefined;
  return {
    provider: asString(message.provider, "unknown"),
    model: asString(message.model, "unknown"),
    usage: {
      input: asNumber(usage.input),
      output: asNumber(usage.output),
      cacheRead: asNumber(usage.cacheRead),
      totalTokens: asNumber(usage.totalTokens),
      cost: {
        input: asNumber(cost?.input),
        output: asNumber(cost?.output),
        cacheRead: asNumber(cost?.cacheRead),
        total: asNumber(cost?.total),
      },
    },
  };
};

const readMessageUsages = async (
  sessionTreeFile: string
): Promise<MessageUsage[]> => {
  const content = await readFile(sessionTreeFile, "utf8");
  const messageUsages: MessageUsage[] = [];

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const messageUsage = extractMessageUsage(line);
    if (messageUsage) messageUsages.push(messageUsage);
  }

  return messageUsages;
};

const scanUsage = async (): Promise<ScanResult> => {
  const sessionDir = getDefaultSessionDir();
  const sessionTreeFiles = await findSessionTreeFiles(sessionDir);
  const messageUsages: MessageUsage[] = [];

  await Promise.all(
    sessionTreeFiles.map(async (sessionTreeFile) => {
      try {
        messageUsages.push(...(await readMessageUsages(sessionTreeFile)));
      } catch {
        // Silently skip unreadable or malformed session trees.
      }
    })
  );

  return {
    sessionDir,
    sessionTreesScanned: sessionTreeFiles.length,
    messageUsages,
  };
};

const addMessageUsageToTotals = (
  totals: Totals,
  messageUsage: MessageUsage
): void => {
  const { usage } = messageUsage;
  const cost = usage.cost ?? {};

  totals.messages += 1;
  totals.input += usage.input ?? 0;
  totals.output += usage.output ?? 0;
  totals.cacheRead += usage.cacheRead ?? 0;
  totals.totalTokens += usage.totalTokens ?? 0;
  totals.costInput += cost.input ?? 0;
  totals.costOutput += cost.output ?? 0;
  totals.costCacheRead += cost.cacheRead ?? 0;
  totals.costTotal += cost.total ?? 0;
};

const aggregateTotals = (messageUsages: MessageUsage[]): Totals => {
  const totals = emptyTotals();
  for (const messageUsage of messageUsages)
    addMessageUsageToTotals(totals, messageUsage);
  return totals;
};

const aggregateByModel = (
  messageUsages: MessageUsage[]
): Map<string, Totals> => {
  const byModel = new Map<string, Totals>();

  for (const messageUsage of messageUsages) {
    const key = `${messageUsage.provider}/${messageUsage.model}`;
    let totals = byModel.get(key);
    if (!totals) {
      totals = emptyTotals();
      byModel.set(key, totals);
    }
    addMessageUsageToTotals(totals, messageUsage);
  }

  return byModel;
};

const formatInteger = (value: number): string =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value === 0 ? 2 : 4,
    maximumFractionDigits: value < 1 && value > 0 ? 6 : 4,
  }).format(value);

const formatLine = (label: string, value: string): string =>
  `  ${label.padEnd(18)} ${value}`;

const renderReport = (scan: ScanResult): string => {
  const totals = aggregateTotals(scan.messageUsages);
  const byModel = [...aggregateByModel(scan.messageUsages).entries()].sort(
    ([, a], [, b]) => b.costTotal - a.costTotal || b.totalTokens - a.totalTokens
  );

  const lines: string[] = [
    "Cumulative Pi usage",
    "",
    formatLine("Session dir:", scan.sessionDir),
    formatLine("Session trees:", formatInteger(scan.sessionTreesScanned)),
    formatLine("Messages:", formatInteger(totals.messages)),
    "",
    "Tokens",
    formatLine("Input:", formatInteger(totals.input)),
    formatLine("Output:", formatInteger(totals.output)),
    formatLine("Cache read:", formatInteger(totals.cacheRead)),
    formatLine("Total:", formatInteger(totals.totalTokens)),
    "",
    "Cost",
    formatLine("Input:", formatCurrency(totals.costInput)),
    formatLine("Output:", formatCurrency(totals.costOutput)),
    formatLine("Cache read:", formatCurrency(totals.costCacheRead)),
    formatLine("Total:", formatCurrency(totals.costTotal)),
  ];

  if (byModel.length > 0) {
    lines.push("", "By provider/model");
    for (const [model, modelTotals] of byModel) {
      lines.push(
        `  ${model}`,
        `    messages ${formatInteger(modelTotals.messages)} | tokens ${formatInteger(
          modelTotals.totalTokens
        )} | cost ${formatCurrency(modelTotals.costTotal)}`
      );
    }
  }

  return lines.join("\n");
};

export default function (pi: ExtensionAPI) {
  pi.registerCommand(COMMAND_NAME, {
    description:
      "Show cumulative token and cost usage across all saved sessions",
    handler: async (_args, ctx) => {
      const report = renderReport(await scanUsage());

      if (ctx.hasUI) {
        ctx.ui.notify(report, "info");
      } else {
        console.log(report);
      }
    },
  });
}
