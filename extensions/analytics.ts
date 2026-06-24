import { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import path from "path";
import { countBy, isString, toPairs } from "lodash-es";
import { homedir } from "os";
import { existsSync } from "fs";
import { mkdir, readdir, readFile, writeFile } from "fs/promises";
import z from "zod";

const analyticsEventsSchema = z.enum(["tool", "prompt-template", "skill"]);

const analyticsEventSchema = z.object({
  type: analyticsEventsSchema,
  resourceId: z.string(),
  timestamp: z.number(),
});
type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;

const analyticsDataSchema = z.array(analyticsEventSchema);

async function useAnalyticsStore(sessionId: string) {
  const identifier = sessionId;
  const usageDataFilePath = path.join(
    homedir(),
    ".pi",
    "data",
    "analytics",
    `${identifier}.json`
  );

  async function loadExistingEvents(): Promise<AnalyticsEvent[]> {
    if (existsSync(usageDataFilePath)) {
      const data = await readFile(usageDataFilePath, "utf-8");
      const parsedData = JSON.parse(data);

      if (analyticsDataSchema.safeParse(parsedData).success) {
        return parsedData;
      } else {
        console.error(
          "Invalid analytics data format in file:",
          usageDataFilePath
        );
        return [];
      }
    } else {
      return [];
    }
  }

  const events: AnalyticsEvent[] = await loadExistingEvents();

  async function storeEvents() {
    await mkdir(path.dirname(usageDataFilePath), { recursive: true });
    await writeFile(usageDataFilePath, JSON.stringify(events, null, 2));
  }

  function recordEvent(event: AnalyticsEvent) {
    events.push(event);
    storeEvents().catch((err) => {
      console.error("Failed to store analytics events:", err);
    });
  }

  async function loadAllEvents(): Promise<AnalyticsEvent[]> {
    const analyticsDir = path.join(homedir(), ".pi", "data", "analytics");
    if (existsSync(analyticsDir)) {
      const filePaths = await readdir(analyticsDir);
      const fileContents = await Promise.all(
        filePaths.map((file) => {
          const filePath = path.join(analyticsDir, file);
          return readFile(filePath, "utf-8");
        })
      );

      const events = fileContents.flatMap((content) => {
        const parseResult = analyticsDataSchema.safeParse(JSON.parse(content));
        if (parseResult.success) {
          return parseResult.data;
        } else {
          console.error("Invalid analytics data format in file:", content);
          return [];
        }
      });

      return events;
    } else {
      return [];
    }
  }

  return {
    events,
    recordEvent,
    loadAllEvents,
  };
}

function getFormattedResourceEventList(events: AnalyticsEvent[]): string[] {
  const counts = countBy(events, (event) => event.resourceId);

  const resourceCountPairs = toPairs(counts).sort(
    ([, countA], [, countB]) => countB - countA
  );

  return resourceCountPairs.map(
    ([resourceId, count]) => `  ${resourceId}: ${count}`
  );
}

function formatAnalyticsReport(events: AnalyticsEvent[]): string[] {
  const toolCallList = getFormattedResourceEventList(
    events.filter((event) => event.type === "tool")
  );
  const promptTemplateCallList = getFormattedResourceEventList(
    events.filter((event) => event.type === "prompt-template")
  );
  const skillCallList = getFormattedResourceEventList(
    events.filter((event) => event.type === "skill")
  );

  return [
    "Analytics Report:",
    "",
    "Total Events: " + events.length,
    "",
    "Tool Usage:",
    ...toolCallList,
    "",
    "Prompt Template Usage:",
    ...promptTemplateCallList,
    "",
    "Skill Usage:",
    ...skillCallList,
  ];
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("analytics", {
    handler: async (args, ctx) => {
      const sessionId = ctx.sessionManager.getSessionId();
      const analyticsStore = await useAnalyticsStore(sessionId);

      const allEvents = await analyticsStore.loadAllEvents();

      if (ctx.hasUI) {
        const reportLines = formatAnalyticsReport(allEvents);
        ctx.ui.notify(reportLines.join("\n"), "info");
      } else {
        const reportLines = formatAnalyticsReport(allEvents);
        console.info(reportLines.join("\n"));
      }
    },
  });

  pi.on("tool_call", async (event, ctx) => {
    const sessionId = ctx.sessionManager.getSessionId();
    const analyticsStore = await useAnalyticsStore(sessionId);
    analyticsStore.recordEvent({
      type: "tool",
      resourceId: event.toolName,
      timestamp: Date.now(),
    });
  });

  pi.on("message_start", async (event, ctx) => {
    if (event.message.role === "user" && isString(event.message.content)) {
      const messageContent = event.message.content;
      const sessionId = ctx.sessionManager.getSessionId();
      const analyticsStore = await useAnalyticsStore(sessionId);

      const skills = pi.getCommands().filter((cmd) => cmd.source === "skill");
      const matchedSkill = skills.find((cmd) =>
        messageContent.includes(cmd.name)
      );

      const templatePrompts = pi
        .getCommands()
        .filter((cmd) => cmd.source === "prompt");
      const matchedTemplate = templatePrompts.find((cmd) =>
        messageContent.includes(cmd.name)
      );

      if (matchedSkill) {
        analyticsStore.recordEvent({
          type: "skill",
          resourceId: matchedSkill.name,
          timestamp: Date.now(),
        });
      } else if (matchedTemplate) {
        analyticsStore.recordEvent({
          type: "prompt-template",
          resourceId: matchedTemplate.name,
          timestamp: Date.now(),
        });
      }
    }
  });
}
