import type {
  AssistantMessage,
  Message,
  SystemMessage,
  Tool,
} from "@earendil-works/pi-ai";
import { getSystemMessageText } from "@earendil-works/pi-ai";
import {
  convertToLlm,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import { sum, sumBy } from "lodash-es";

import { formatTokens } from "../../utils/formatting";

const CONTEXT_CATEGORIES = [
  { category: "systemPrompt", label: "sys" },
  { category: "tools", label: "tools" },
  { category: "user", label: "user" },
  { category: "agent", label: "agent" },
  { category: "thinking", label: "think" },
  { category: "toolCalls", label: "calls" },
  { category: "toolResults", label: "results" },
] as const;

const CONTEXT_WIDGET_KEY = "context-analysis";
const ESTIMATED_IMAGE_CHARACTERS = 4_800;

type ContextCategory = (typeof CONTEXT_CATEGORIES)[number]["category"];
type ContextComposition = Record<ContextCategory, number>;

interface ContextContribution {
  category: ContextCategory;
  tokens: number;
}

function estimateTokens(characters: number): number {
  return Math.ceil(characters / 4);
}

function estimateContentTokens(
  content: Extract<Message, { role: "user" | "toolResult" }>["content"]
): number {
  if (typeof content === "string") return estimateTokens(content.length);

  return estimateTokens(
    sumBy(content, (block) =>
      block.type === "text" ? block.text.length : ESTIMATED_IMAGE_CHARACTERS
    )
  );
}

function estimateToolTokens(tool: Tool): number {
  return estimateTokens(
    tool.name.length +
      tool.description.length +
      JSON.stringify(tool.parameters).length +
      2
  );
}

function countSystemMessage(message: SystemMessage): ContextContribution[] {
  return [
    {
      category: "systemPrompt",
      tokens: estimateTokens(getSystemMessageText(message).length),
    },
    {
      category: "tools",
      tokens:
        sum(message.toolsAdded?.map(estimateToolTokens) ?? []) +
        estimateTokens(
          message.toolsRemoved?.map(({ name }) => name).join("\n").length ?? 0
        ),
    },
  ];
}

function countVisibleAssistantBlock(
  block: AssistantMessage["content"][number]
): ContextContribution[] {
  if (block.type === "thinking") return [];
  if (block.type === "text") {
    return [{ category: "agent", tokens: estimateTokens(block.text.length) }];
  }

  return [
    {
      category: "toolCalls",
      tokens: estimateTokens(
        block.name.length + JSON.stringify(block.arguments).length + 1
      ),
    },
  ];
}

function countAssistantMessage(
  message: AssistantMessage
): ContextContribution[] {
  const visibleContributions = message.content.flatMap(
    countVisibleAssistantBlock
  );
  const thinkingBlocks = message.content.filter(
    (block) => block.type === "thinking"
  );
  if (thinkingBlocks.length === 0) return visibleContributions;

  const estimatedVisibleTokens = sumBy(
    visibleContributions,
    ({ tokens }) => tokens
  );
  const thinkingTokens =
    message.usage.reasoning ??
    Math.max(0, message.usage.output - estimatedVisibleTokens);

  return [
    ...visibleContributions,
    { category: "thinking", tokens: thinkingTokens },
  ];
}

function countMessage(message: Message): ContextContribution[] {
  if (message.role === "system") return countSystemMessage(message);
  if (message.role === "assistant") return countAssistantMessage(message);

  return [
    {
      category: message.role === "user" ? "user" : "toolResults",
      tokens: estimateContentTokens(message.content),
    },
  ];
}

function mapComposition(
  getTokens: (category: ContextCategory) => number
): ContextComposition {
  return Object.fromEntries(
    CONTEXT_CATEGORIES.map(({ category }) => [category, getTokens(category)])
  ) as ContextComposition;
}

function countComposition(messages: Message[]): ContextComposition {
  const contributions = messages.flatMap(countMessage);
  return mapComposition((category) =>
    sumBy(contributions, (item) =>
      item.category === category ? item.tokens : 0
    )
  );
}

function normalizeComposition(
  composition: ContextComposition,
  totalTokens: number | null | undefined
): ContextComposition {
  const adjustableTotal =
    sum(Object.values(composition)) - composition.thinking;
  if (
    totalTokens === null ||
    totalTokens === undefined ||
    adjustableTotal === 0
  ) {
    return composition;
  }

  const scale =
    Math.max(0, totalTokens - composition.thinking) / adjustableTotal;
  return mapComposition((category) =>
    category === "thinking"
      ? composition.thinking
      : Math.round(composition[category] * scale)
  );
}

function formatComposition(composition: ContextComposition): string {
  return CONTEXT_CATEGORIES.map(
    ({ category, label }) => `${label} ${formatTokens(composition[category])}`
  ).join(" · ");
}

export default function (pi: ExtensionAPI) {
  pi.on("turn_start", (_event, ctx) => {
    if (ctx.mode !== "tui") return;

    const messages = convertToLlm(
      ctx.sessionManager.buildSessionProjection().messages
    );
    const composition = normalizeComposition(
      countComposition(messages),
      ctx.getContextUsage()?.tokens
    );
    const line = `ctx: ${formatComposition(composition)}`;

    ctx.ui.setWidget(
      CONTEXT_WIDGET_KEY,
      (_tui, theme) => ({
        invalidate() {},
        render(width) {
          return [
            truncateToWidth(
              theme.fg("dim", line),
              width,
              theme.fg("dim", "...")
            ),
          ];
        },
      }),
      { placement: "belowEditor" }
    );
  });

  pi.on("session_shutdown", (_event, ctx) => {
    if (ctx.mode === "tui") {
      ctx.ui.setWidget(CONTEXT_WIDGET_KEY, undefined);
    }
  });
}
