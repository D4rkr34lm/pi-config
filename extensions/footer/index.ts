import type { AssistantMessage } from "@earendil-works/pi-ai";
import {
  buildSessionContext,
  type ExtensionAPI,
  type ExtensionContext,
  type ReadonlyFooterDataProvider,
  type Theme,
} from "@earendil-works/pi-coding-agent";
import type { Component, TUI } from "@earendil-works/pi-tui";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { isAbsolute, relative, resolve, sep } from "node:path";

const MIN_RIGHT_PADDING = 2;
const ESTIMATED_IMAGE_CHARS = 4800;

const CONTEXT_BREAKDOWN_KEYS = [
  "system",
  "toolDefinitions",
  "user",
  "assistant",
  "reasoning",
  "toolCalls",
  "toolResults",
  "summaries",
  "custom",
  "bash",
] as const;

type FooterSnapshot = {
  ctx: ExtensionContext;
  pi: ExtensionAPI;
  theme: Theme;
  footerData: ReadonlyFooterDataProvider;
  width: number;
  usage: FooterUsage;
  context: FooterContextUsage;
};

type FooterUsage = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
  latestCacheHitRate?: number;
};

type FooterContextUsage = {
  tokens: number | null;
  percentDisplay: string;
  percentValue: number;
  contextWindow: number;
  breakdown: ContextBreakdown;
};

type ContextBreakdownKey = (typeof CONTEXT_BREAKDOWN_KEYS)[number];

type ContextBreakdown = Record<ContextBreakdownKey, number>;

type ContentBlock = {
  type: string;
  text?: string;
  thinking?: string;
  name?: string;
  arguments?: unknown;
};

type TextAndImageContent = string | ContentBlock[];

type FooterToken = {
  id: string;
  render: (snapshot: FooterSnapshot) => string | undefined;
};

type JoinedRow = {
  id: string;
  kind: "joined";
  tokens: FooterToken[];
  separator: string;
  style?: (snapshot: FooterSnapshot, text: string) => string;
  includeWhen?: (snapshot: FooterSnapshot) => boolean;
};

type SplitRow = {
  id: string;
  kind: "split";
  left: FooterToken[];
  right: FooterToken[];
  leftSeparator: string;
  rightSeparator: string;
  style?: (snapshot: FooterSnapshot, text: string) => string;
  includeWhen?: (snapshot: FooterSnapshot) => boolean;
};

type FooterRow = JoinedRow | SplitRow;

const sanitizeStatusText = (text: string): string =>
  text
    .replace(/[\r\n\t]/g, " ")
    .replace(/ +/g, " ")
    .trim();

const formatTokens = (count: number): string => {
  if (count < 1000) return count.toString();
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1000000) return `${Math.round(count / 1000)}k`;
  if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`;
  return `${Math.round(count / 1000000)}M`;
};

const tokensFromChars = (chars: number): number => Math.ceil(chars / 4);

const emptyContextBreakdown = (): ContextBreakdown =>
  Object.fromEntries(
    CONTEXT_BREAKDOWN_KEYS.map((key) => [key, 0])
  ) as ContextBreakdown;

const contextBreakdownWith = (
  key: ContextBreakdownKey,
  chars: number
): ContextBreakdown => ({ ...emptyContextBreakdown(), [key]: chars });

const mergeContextBreakdowns = (
  breakdowns: ContextBreakdown[]
): ContextBreakdown =>
  Object.fromEntries(
    CONTEXT_BREAKDOWN_KEYS.map((key) => [
      key,
      breakdowns.reduce((total, breakdown) => total + breakdown[key], 0),
    ])
  ) as ContextBreakdown;

const tokenizedContextBreakdown = (
  breakdown: ContextBreakdown
): ContextBreakdown =>
  Object.fromEntries(
    CONTEXT_BREAKDOWN_KEYS.map((key) => [key, tokensFromChars(breakdown[key])])
  ) as ContextBreakdown;

const totalContextBreakdownTokens = (breakdown: ContextBreakdown): number =>
  CONTEXT_BREAKDOWN_KEYS.reduce((total, key) => total + breakdown[key], 0);

const normalizeContextBreakdown = (
  breakdown: ContextBreakdown,
  targetTotal: number | null
): ContextBreakdown => {
  const sourceTotal = totalContextBreakdownTokens(breakdown);
  if (targetTotal === null || sourceTotal <= 0) return breakdown;

  const scaled = CONTEXT_BREAKDOWN_KEYS.map((key) => {
    const exact = (breakdown[key] / sourceTotal) * targetTotal;
    return { key, base: Math.floor(exact), fraction: exact % 1 };
  });
  const baseTotal = scaled.reduce((total, part) => total + part.base, 0);
  const incrementedKeys = new Set(
    [...scaled]
      .sort((a, b) => b.fraction - a.fraction)
      .slice(0, targetTotal - baseTotal)
      .map((part) => part.key)
  );

  return Object.fromEntries(
    scaled.map((part) => [
      part.key,
      part.base + (incrementedKeys.has(part.key) ? 1 : 0),
    ])
  ) as ContextBreakdown;
};

const safeJsonLength = (value: unknown): number => {
  try {
    return JSON.stringify(value)?.length ?? 0;
  } catch {
    return 0;
  }
};

const estimateTextAndImageContentChars = (
  content: TextAndImageContent
): number =>
  typeof content === "string"
    ? content.length
    : content.reduce(
        (total, block) =>
          total +
          (block.type === "text"
            ? (block.text?.length ?? 0)
            : block.type === "image"
              ? ESTIMATED_IMAGE_CHARS
              : 0),
        0
      );

const estimateAssistantContentChars = (
  content: AssistantMessage["content"]
): ContextBreakdown =>
  mergeContextBreakdowns(
    content.map((block) => {
      if (block.type === "text")
        return contextBreakdownWith("assistant", block.text.length);
      if (block.type === "thinking")
        return contextBreakdownWith("reasoning", block.thinking.length);
      return contextBreakdownWith(
        "toolCalls",
        block.name.length + safeJsonLength(block.arguments)
      );
    })
  );

const estimateMessageContextChars = (
  message: ReturnType<typeof buildSessionContext>["messages"][number]
): ContextBreakdown => {
  switch (message.role) {
    case "user":
      return contextBreakdownWith(
        "user",
        estimateTextAndImageContentChars(message.content)
      );
    case "assistant":
      return estimateAssistantContentChars(message.content);
    case "toolResult":
      return contextBreakdownWith(
        "toolResults",
        estimateTextAndImageContentChars(message.content)
      );
    case "custom":
      return contextBreakdownWith(
        "custom",
        estimateTextAndImageContentChars(message.content)
      );
    case "bashExecution":
      return contextBreakdownWith(
        "bash",
        message.command.length + message.output.length
      );
    case "branchSummary":
    case "compactionSummary":
      return contextBreakdownWith("summaries", message.summary.length);
  }

  return emptyContextBreakdown();
};

const estimateActiveToolDefinitionChars = (pi: ExtensionAPI): number => {
  const activeTools = new Set(pi.getActiveTools());
  return pi
    .getAllTools()
    .filter((tool) => activeTools.has(tool.name))
    .reduce(
      (total, tool) =>
        total +
        tool.name.length +
        tool.description.length +
        safeJsonLength(tool.parameters),
      0
    );
};

const collectContextBreakdown = (
  pi: ExtensionAPI,
  ctx: ExtensionContext
): ContextBreakdown =>
  tokenizedContextBreakdown(
    mergeContextBreakdowns([
      contextBreakdownWith("system", ctx.getSystemPrompt().length),
      contextBreakdownWith(
        "toolDefinitions",
        estimateActiveToolDefinitionChars(pi)
      ),
      ...buildSessionContext(
        ctx.sessionManager.getEntries(),
        ctx.sessionManager.getLeafId()
      ).messages.map(estimateMessageContextChars),
    ])
  );

const formatCwdForFooter = (cwd: string, home: string | undefined): string => {
  if (!home) return cwd;

  const resolvedCwd = resolve(cwd);
  const resolvedHome = resolve(home);
  const relativeToHome = relative(resolvedHome, resolvedCwd);
  const isInsideHome =
    relativeToHome === "" ||
    (relativeToHome !== ".." &&
      !relativeToHome.startsWith(`..${sep}`) &&
      !isAbsolute(relativeToHome));

  if (!isInsideHome) return cwd;
  return relativeToHome === "" ? "~" : `~${sep}${relativeToHome}`;
};

const collectUsage = (ctx: ExtensionContext): FooterUsage => {
  const usage: FooterUsage = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    cost: 0,
  };

  // Match pi's default footer: cumulative stats from all entries in the
  // session tree, not only the current branch.
  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type !== "message" || entry.message.role !== "assistant") {
      continue;
    }

    const message = entry.message as AssistantMessage;
    usage.input += message.usage.input ?? 0;
    usage.output += message.usage.output ?? 0;
    usage.cacheRead += message.usage.cacheRead ?? 0;
    usage.cacheWrite += message.usage.cacheWrite ?? 0;
    usage.cost += message.usage.cost?.total ?? 0;

    const latestPromptTokens =
      (message.usage.input ?? 0) +
      (message.usage.cacheRead ?? 0) +
      (message.usage.cacheWrite ?? 0);
    usage.latestCacheHitRate =
      latestPromptTokens > 0
        ? ((message.usage.cacheRead ?? 0) / latestPromptTokens) * 100
        : undefined;
  }

  return usage;
};

const collectContextUsage = (
  pi: ExtensionAPI,
  ctx: ExtensionContext
): FooterContextUsage => {
  const usage = ctx.getContextUsage();
  const contextWindow = usage?.contextWindow ?? ctx.model?.contextWindow ?? 0;
  const percentValue = usage?.percent ?? 0;
  const percentDisplay =
    usage?.percent === null ? "?" : percentValue.toFixed(1);

  const tokens = usage?.tokens ?? null;

  return {
    tokens,
    percentDisplay,
    percentValue,
    contextWindow,
    breakdown: normalizeContextBreakdown(
      collectContextBreakdown(pi, ctx),
      tokens
    ),
  };
};

const renderTokens = (
  tokens: FooterToken[],
  snapshot: FooterSnapshot,
  separator: string
): string =>
  tokens
    .map((token) => token.render(snapshot))
    .filter((part): part is string => Boolean(part))
    .join(separator);

const renderJoinedRow = (
  row: JoinedRow,
  snapshot: FooterSnapshot
): string[] => {
  if (row.includeWhen && !row.includeWhen(snapshot)) return [];

  const raw = renderTokens(row.tokens, snapshot, row.separator);
  if (!raw) return [];

  const styled = row.style ? row.style(snapshot, raw) : raw;
  return [
    truncateToWidth(styled, snapshot.width, snapshot.theme.fg("dim", "...")),
  ];
};

const renderSplitRow = (row: SplitRow, snapshot: FooterSnapshot): string[] => {
  if (row.includeWhen && !row.includeWhen(snapshot)) return [];

  let left = renderTokens(row.left, snapshot, row.leftSeparator);
  const right = renderTokens(row.right, snapshot, row.rightSeparator);
  if (!left && !right) return [];

  if (visibleWidth(left) > snapshot.width) {
    left = truncateToWidth(left, snapshot.width, "...");
  }

  const leftWidth = visibleWidth(left);
  const rightWidth = visibleWidth(right);
  const totalNeeded = leftWidth + MIN_RIGHT_PADDING + rightWidth;

  let line: string;
  if (!right) {
    line = left;
  } else if (totalNeeded <= snapshot.width) {
    line = left + " ".repeat(snapshot.width - leftWidth - rightWidth) + right;
  } else {
    const availableForRight = snapshot.width - leftWidth - MIN_RIGHT_PADDING;
    if (availableForRight > 0) {
      const truncatedRight = truncateToWidth(right, availableForRight, "");
      line =
        left +
        " ".repeat(
          Math.max(0, snapshot.width - leftWidth - visibleWidth(truncatedRight))
        ) +
        truncatedRight;
    } else {
      line = left;
    }
  }

  const styled = row.style ? row.style(snapshot, line) : line;
  return [
    truncateToWidth(styled, snapshot.width, snapshot.theme.fg("dim", "...")),
  ];
};

const defaultFooterRows: FooterRow[] = [
  {
    id: "location",
    kind: "joined",
    separator: " • ",
    style: ({ theme }, text) => theme.fg("dim", text),
    tokens: [
      {
        id: "cwd-and-branch",
        render: ({ ctx, footerData }) => {
          const cwd = formatCwdForFooter(
            ctx.sessionManager.getCwd(),
            process.env.HOME || process.env.USERPROFILE
          );
          const branch = footerData.getGitBranch();
          return branch ? `${cwd} (${branch})` : cwd;
        },
      },
      {
        id: "session-name",
        render: ({ pi, ctx }) =>
          pi.getSessionName() ?? ctx.sessionManager.getSessionName(),
      },
    ],
  },
  {
    id: "stats-and-model",
    kind: "split",
    leftSeparator: " ",
    rightSeparator: " • ",
    style: ({ theme }, text) => theme.fg("dim", text),
    left: [
      {
        id: "input-tokens",
        render: ({ usage }) =>
          usage.input ? `↑${formatTokens(usage.input)}` : undefined,
      },
      {
        id: "output-tokens",
        render: ({ usage }) =>
          usage.output ? `↓${formatTokens(usage.output)}` : undefined,
      },
      {
        id: "cache-read",
        render: ({ usage }) =>
          usage.cacheRead ? `R${formatTokens(usage.cacheRead)}` : undefined,
      },
      {
        id: "cache-write",
        render: ({ usage }) =>
          usage.cacheWrite ? `W${formatTokens(usage.cacheWrite)}` : undefined,
      },
      {
        id: "cache-hit-rate",
        render: ({ usage }) =>
          (usage.cacheRead > 0 || usage.cacheWrite > 0) &&
          usage.latestCacheHitRate !== undefined
            ? `CH${usage.latestCacheHitRate.toFixed(1)}%`
            : undefined,
      },
      {
        id: "cost",
        render: ({ ctx, usage }) => {
          const usingSubscription = ctx.model
            ? ctx.modelRegistry.isUsingOAuth(ctx.model)
            : false;
          if (!usage.cost && !usingSubscription) return undefined;
          return `$${usage.cost.toFixed(3)}${usingSubscription ? " (sub)" : ""}`;
        },
      },
      {
        id: "context",
        render: ({ context, theme }) => {
          const autoIndicator = " (auto)";
          const contextWindow = formatTokens(context.contextWindow);
          const value =
            context.tokens === null || context.percentDisplay === "?"
              ? `?/${contextWindow}${autoIndicator}`
              : `${formatTokens(context.tokens)}/${contextWindow} (${context.percentDisplay}%)${autoIndicator}`;

          if (context.percentValue > 90) return theme.fg("error", value);
          if (context.percentValue > 70) return theme.fg("warning", value);
          return value;
        },
      },
    ],
    right: [
      {
        id: "provider",
        render: ({ ctx, footerData, width }) => {
          if (!ctx.model || footerData.getAvailableProviderCount() <= 1)
            return undefined;

          const provider = `(${ctx.model.provider})`;
          // Keep provider declarative but conservative: if the terminal is very
          // narrow, model id is more useful than provider name.
          return width >= 80 ? provider : undefined;
        },
      },
      {
        id: "model",
        render: ({ ctx }) => ctx.model?.id ?? "no-model",
      },
      {
        id: "thinking",
        render: ({ ctx, pi }) => {
          if (!ctx.model?.reasoning) return undefined;
          const level = pi.getThinkingLevel() || "off";
          return level === "off" ? "thinking off" : level;
        },
      },
    ],
  },
  {
    id: "context-breakdown",
    kind: "joined",
    separator: " ",
    style: ({ theme }, text) => theme.fg("dim", text),
    includeWhen: ({ context }) =>
      CONTEXT_BREAKDOWN_KEYS.some((key) => context.breakdown[key] > 0),
    tokens: [
      {
        id: "context-breakdown-parts",
        render: ({ context }) => {
          const labels: Record<ContextBreakdownKey, string> = {
            system: "sys",
            toolDefinitions: "tools",
            user: "user",
            assistant: "asst",
            reasoning: "think",
            toolCalls: "calls",
            toolResults: "results",
            summaries: "sum",
            custom: "custom",
            bash: "bash",
          };
          const parts = CONTEXT_BREAKDOWN_KEYS.filter(
            (key) => context.breakdown[key] > 0
          )
            .map(
              (key) => `${labels[key]} ${formatTokens(context.breakdown[key])}`
            )
            .join(" • ");

          return parts ? `ctx: ${parts}` : undefined;
        },
      },
    ],
  },
  {
    id: "extension-statuses",
    kind: "joined",
    separator: " ",
    includeWhen: ({ footerData }) => footerData.getExtensionStatuses().size > 0,
    tokens: [
      {
        id: "statuses",
        render: ({ footerData }) =>
          Array.from(footerData.getExtensionStatuses().entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([, text]) => sanitizeStatusText(text))
            .join(" "),
      },
    ],
  },
];

class DeclarativeFooter implements Component {
  private readonly pi: ExtensionAPI;
  private readonly ctx: ExtensionContext;
  private readonly theme: Theme;
  private readonly footerData: ReadonlyFooterDataProvider;
  private readonly rows: FooterRow[];
  private readonly unsubscribeFromBranchChanges: () => void;

  constructor(
    pi: ExtensionAPI,
    ctx: ExtensionContext,
    theme: Theme,
    footerData: ReadonlyFooterDataProvider,
    rows: FooterRow[],
    unsubscribeFromBranchChanges: () => void
  ) {
    this.pi = pi;
    this.ctx = ctx;
    this.theme = theme;
    this.footerData = footerData;
    this.rows = rows;
    this.unsubscribeFromBranchChanges = unsubscribeFromBranchChanges;
  }

  render(width: number): string[] {
    const snapshot: FooterSnapshot = {
      ctx: this.ctx,
      pi: this.pi,
      theme: this.theme,
      footerData: this.footerData,
      width,
      usage: collectUsage(this.ctx),
      context: collectContextUsage(this.pi, this.ctx),
    };

    return this.rows.flatMap((row) =>
      row.kind === "joined"
        ? renderJoinedRow(row, snapshot)
        : renderSplitRow(row, snapshot)
    );
  }

  invalidate(): void {}

  dispose(): void {
    this.unsubscribeFromBranchChanges();
  }
}

export default function (pi: ExtensionAPI): void {
  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui") return;

    ctx.ui.setFooter((tui: TUI, theme: Theme, footerData) => {
      const unsubscribe = footerData.onBranchChange(() => tui.requestRender());
      return new DeclarativeFooter(
        pi,
        ctx,
        theme,
        footerData,
        defaultFooterRows,
        unsubscribe
      );
    });
  });

  pi.on("session_shutdown", (_event, ctx) => {
    if (ctx.mode === "tui") ctx.ui.setFooter(undefined);
  });
}
