import { TSchema } from "@earendil-works/pi-ai";
import { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { get, isString, sum } from "lodash-es";

interface ContextComposition {
  systemPrompt: number;
  tools: number;
  toolCalls: number;
  toolResults: number;
  thinking: number;
  user: number;
  agent: number;
}

function getTokenEstimation(text: string): number {
  return Math.ceil(text.length / 4);
}

function stringifySchema(schema: TSchema): string {
  return JSON.stringify(schema);
}

export default function (pi: ExtensionAPI) {
  pi.on("turn_start", async (event, ctx) => {
    const sessionManager = ctx.sessionManager;

    const context = sessionManager.buildSessionProjection();

    context.entries.map((entry) =>
      entry.messages.map((message) => {
        if (message.role === "system") {
          const toolsTokenEstimate = sum(
            message.toolsAdded?.map((tool) => {
              const name = tool.name;
              const description = tool.description;
              const inputSchema = stringifySchema(tool.parameters);

              const toolTokenEstimate = getTokenEstimation(
                `${name}\n${description}\n${inputSchema}`
              );

              return toolTokenEstimate;
            })
          );
        } else if (message.role === "assistant") {
          const assistantText = message.content
            .filter((content) => content.type === "text")
            .map((conent) => conent.text)
            .join("\n");
        } else if (message.role === "toolResult") {
        } else if (message.role === "user") {
          const text = isString(message.content)
            ? message.content
            : message.content
                .filter((content) => content.type === "text")
                .map((content) => content.text)
                .join("\n");
          const tokenCount = getTokenEstimation(text);

          return {
            user: tokenCount,
          };
        }
      })
    );
  });
}
