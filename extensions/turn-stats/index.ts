import type { Usage } from "@earendil-works/pi-ai";
import type {
  ExtensionAPI,
  SessionEntry,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { first } from "lodash-es";
import {
  formatDuration,
  formatStartTime,
  formatTokens,
} from "../../utils/formatting";
import { hasValue } from "../../utils/type-guards";

const AGENT_WORK_START_ENTRY_TYPE = "agent-work-start";
const AGENT_WORK_STATS_ENTRY_TYPE = "agent-work-stats";

interface AgentWorkStats {
  startedAt: string;
  endedAt: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
}

function extractUsages(entries: readonly SessionEntry[]): Usage[] {
  return entries.flatMap((entry) => {
    if (entry.type === "usage") return [entry.usage];
    if (entry.type === "compaction" || entry.type === "branch_summary") {
      return entry.usage ? [entry.usage] : [];
    }
    if (entry.type !== "message") return [];
    if (entry.message.role === "assistant") return [entry.message.usage];
    if (entry.message.role === "toolResult" && entry.message.usage) {
      return [entry.message.usage];
    }
    return [];
  });
}

export default function (pi: ExtensionAPI) {
  pi.on("before_agent_start", () => {
    pi.appendEntry(AGENT_WORK_START_ENTRY_TYPE);
  });

  pi.on("agent_before_settle", (event, ctx) => {
    if (event.continue) return;
    const branch = ctx.sessionManager.getBranch();
    const latestAgentWorkStartEntry = first(
      branch
        .filter(
          (entry) =>
            entry.type === "custom" &&
            entry.customType === AGENT_WORK_START_ENTRY_TYPE
        )
        .sort((a, b) =>
          new Date(a.timestamp) > new Date(b.timestamp) ? -1 : 1
        )
    );

    if (!hasValue(latestAgentWorkStartEntry)) return;

    const startEntryIndex = branch.findIndex(
      (entry) => entry.id === latestAgentWorkStartEntry.id
    );
    const usages = extractUsages(branch.slice(startEntryIndex + 1));
    const tokenUsage = usages.reduce(
      (total, usage) => ({
        input: total.input + usage.input,
        output: total.output + usage.output,
      }),
      { input: 0, output: 0 }
    );
    const start = new Date(latestAgentWorkStartEntry.timestamp);
    const end = new Date();

    return {
      entries: [
        {
          type: "custom" as const,
          customType: AGENT_WORK_STATS_ENTRY_TYPE,
          data: {
            startedAt: start.toISOString(),
            endedAt: end.toISOString(),
            durationMs: Math.max(0, end.getTime() - start.getTime()),
            inputTokens: tokenUsage.input,
            outputTokens: tokenUsage.output,
          } satisfies AgentWorkStats,
        },
      ],
    };
  });

  pi.registerEntryRenderer<AgentWorkStats>(
    AGENT_WORK_STATS_ENTRY_TYPE,
    (entry, _options, theme) => {
      if (!entry.data) return undefined;

      const separator = theme.fg("dim", "  ·  ");
      const line = [
        `${theme.fg("dim", "◷")} ${theme.fg(
          "muted",
          formatDuration(entry.data.durationMs)
        )}`,
        theme.fg("dim", `started ${formatStartTime(entry.data.startedAt)}`),
        theme.fg(
          "dim",
          `↑${formatTokens(entry.data.inputTokens)} ↓${formatTokens(
            entry.data.outputTokens
          )}`
        ),
      ].join(separator);

      return new Text(line, 1, 0);
    }
  );
}
