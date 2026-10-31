import type {
  AssistantMessage,
  Message,
  SystemMessage,
  Tool,
} from "@earendil-works/pi-ai";
import { getSystemMessageText } from "@earendil-works/pi-ai";
import {
  estimateMessageTokens,
  estimateTextAndImageContentTokens,
  estimateTextTokens,
} from "@earendil-works/pi-ai/utils/estimate";
import {
  convertToLlm,
  type ExtensionAPI,
  type ExtensionContext,
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

type ContextCategory = (typeof CONTEXT_CATEGORIES)[number]["category"];
type ContextComposition = Record<ContextCategory, number>;

interface ContextContribution {
  category: ContextCategory;
  tokens: number;
}

function applyToolChanges(tools: Tool[], message: SystemMessage): Tool[] {
  const removedNames = new Set(
    message.toolsRemoved?.map(({ name }) => name) ?? []
  );
  const addedTools = message.toolsAdded ?? [];
  const addedNames = new Set(addedTools.map(({ name }) => name));

  return [
    ...tools.filter(
      ({ name }) => !removedNames.has(name) && !addedNames.has(name)
    ),
    ...addedTools,
  ];
}

function countCurrentSystem(
  messages: Message[],
  systemPrompt: string
): ContextContribution[] {
  // System transcript entries are deltas. Replay tools and use Pi's effective
  // prompt so replaced sections and removed tools are not counted twice.
  const activeTools = messages
    .filter((message): message is SystemMessage => message.role === "system")
    .reduce(applyToolChanges, [] as Tool[]);
  const currentSystemMessage: SystemMessage = {
    role: "system",
    content: systemPrompt,
    toolsAdded: activeTools,
    timestamp: 0,
  };
  const systemPromptTokens = estimateTextTokens(
    getSystemMessageText(currentSystemMessage)
  );

  return [
    {
      category: "systemPrompt",
      tokens: systemPromptTokens,
    },
    {
      category: "tools",
      tokens: Math.max(
        0,
        estimateMessageTokens(currentSystemMessage) - systemPromptTokens
      ),
    },
  ];
}

function countVisibleAssistantBlock(
  block: AssistantMessage["content"][number]
): ContextContribution[] {
  if (block.type === "thinking") return [];
  if (block.type === "text") {
    return [{ category: "agent", tokens: estimateTextTokens(block.text) }];
  }

  return [
    {
      category: "toolCalls",
      tokens: estimateTextTokens(
        block.name + (JSON.stringify(block.arguments) ?? "undefined")
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

  const thinkingTokens =
    message.usage.reasoning ??
    sumBy(thinkingBlocks, (block) => estimateTextTokens(block.thinking));

  return [
    ...visibleContributions,
    { category: "thinking", tokens: thinkingTokens },
  ];
}

function countMessage(
  message: Exclude<Message, SystemMessage>
): ContextContribution[] {
  if (message.role === "assistant") return countAssistantMessage(message);

  return [
    {
      category: message.role === "user" ? "user" : "toolResults",
      tokens: estimateTextAndImageContentTokens(message.content),
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

function countComposition(
  messages: Message[],
  systemPrompt: string
): ContextComposition {
  const contributions = [
    ...countCurrentSystem(messages, systemPrompt),
    ...messages
      .filter(
        (message): message is Exclude<Message, SystemMessage> =>
          message.role !== "system"
      )
      .flatMap(countMessage),
  ];
  return mapComposition((category) =>
    sumBy(contributions, (item) =>
      item.category === category ? item.tokens : 0
    )
  );
}

function formatComposition(
  composition: ContextComposition,
  measuredTotal: number | null | undefined
): string {
  // Keep category estimates independent from aggregate provider usage. Scaling
  // every category made an unchanged system prompt drift after each response.
  const total = measuredTotal ?? sum(Object.values(composition));
  const categories = CONTEXT_CATEGORIES.map(
    ({ category, label }) => `${label} ${formatTokens(composition[category])}`
  ).join(" · ");

  return `ctx ${formatTokens(total)}: ${categories}`;
}

function updateWidget(ctx: ExtensionContext): void {
  if (ctx.mode !== "tui") return;

  const messages = convertToLlm(
    ctx.sessionManager.buildSessionProjection().messages
  );
  const line = formatComposition(
    countComposition(messages, ctx.getSystemPrompt()),
    ctx.getContextUsage()?.tokens
  );

  ctx.ui.setWidget(
    CONTEXT_WIDGET_KEY,
    (_tui, theme) => ({
      invalidate() {},
      render(width) {
        return [
          truncateToWidth(theme.fg("dim", line), width, theme.fg("dim", "...")),
        ];
      },
    }),
    { placement: "belowEditor" }
  );
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => updateWidget(ctx));
  pi.on("turn_start", (_event, ctx) => updateWidget(ctx));
  pi.on("turn_end", (_event, ctx) => updateWidget(ctx));
  pi.on("session_compact", (_event, ctx) => updateWidget(ctx));
  pi.on("session_tree", (_event, ctx) => updateWidget(ctx));

  pi.on("session_shutdown", (_event, ctx) => {
    if (ctx.mode === "tui") {
      ctx.ui.setWidget(CONTEXT_WIDGET_KEY, undefined);
    }
  });
}
