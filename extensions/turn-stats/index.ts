import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { first } from "lodash-es";
import { hasValue } from "../../utils/type-guards";

const ASSISTANT_TURN_START_ENTRY_TYPE = "assistant-turn-start";
const ASSISTANT_TURN_END_ENTRY_TYPE = "assistant-turn-end";

interface TurnStats {
  turnStart: string;
  turnEndTimestamp: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1_000) return `${Math.round(durationMs)}ms`;

  const seconds = durationMs / 1_000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;

  const wholeMinutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${wholeMinutes}m ${remainingSeconds}s`;
}

function formatTokens(tokens: number): string {
  if (tokens < 1_000) return tokens.toString();
  if (tokens < 10_000) return `${(tokens / 1_000).toFixed(1)}k`;
  if (tokens < 1_000_000) return `${Math.round(tokens / 1_000)}k`;
  if (tokens < 10_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  return `${Math.round(tokens / 1_000_000)}M`;
}

function formatStartTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function (pi: ExtensionAPI) {
  pi.on("turn_start", () => {
    pi.appendEntry(ASSISTANT_TURN_START_ENTRY_TYPE);
  });

  pi.on("turn_end", (event, ctx) => {
    if (event.message.role !== "assistant") return;

    const latestAssistantTurnStartEntry = first(
      ctx.sessionManager
        .getBranch()
        .filter(
          (entry) =>
            entry.type === "custom" &&
            entry.customType === ASSISTANT_TURN_START_ENTRY_TYPE
        )
        .sort((a, b) =>
          new Date(a.timestamp) > new Date(b.timestamp) ? -1 : 1
        )
    );

    if (!hasValue(latestAssistantTurnStartEntry)) return;

    const start = new Date(latestAssistantTurnStartEntry.timestamp);
    const end = new Date();
    const usages = [
      event.message.usage,
      ...event.toolResults.flatMap((result) =>
        result.usage ? [result.usage] : []
      ),
    ];
    const tokenUsage = usages.reduce(
      (total, usage) => ({
        input: total.input + usage.input,
        output: total.output + usage.output,
      }),
      { input: 0, output: 0 }
    );

    pi.appendEntry(ASSISTANT_TURN_END_ENTRY_TYPE, {
      turnStart: start.toISOString(),
      turnEndTimestamp: end.toISOString(),
      durationMs: Math.max(0, end.getTime() - start.getTime()),
      inputTokens: tokenUsage.input,
      outputTokens: tokenUsage.output,
    } satisfies TurnStats);
  });

  pi.registerEntryRenderer<TurnStats>(
    ASSISTANT_TURN_END_ENTRY_TYPE,
    (entry, _options, theme) => {
      if (!entry.data) return undefined;

      const separator = theme.fg("dim", "  ·  ");
      const line = [
        `${theme.fg("dim", "◷")} ${theme.fg(
          "muted",
          formatDuration(entry.data.durationMs)
        )}`,
        theme.fg("dim", `started ${formatStartTime(entry.data.turnStart)}`),
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
