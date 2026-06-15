import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import {
  clickupListTasks,
  clickupCreateTask,
  clickupUpdateTask,
} from "@/lib/connectors/clickup";

const AI_MODEL = "claude-opus-4-8";

// Tool-use needs the raw Anthropic client (ai.ts only exposes streaming chat).
// Prod uses ANTHROPIC_API_KEY; CLAUDE_API_KEY is the Claude-Code dev fallback.
function getAnthropic(): Anthropic | null {
  const key = env.ANTHROPIC_API_KEY || env.CLAUDE_API_KEY;
  return key ? new Anthropic({ apiKey: key }) : null;
}

/**
 * Cappo's delegated agent. ALLIE (on allen.i.verse) hands Cappo an AMG task via the
 * keyed /api/agent endpoint; Cappo runs Claude with tool-use over AMG's ClickUp and
 * actually executes it, then returns a concise summary up the chain.
 */

const SYSTEM = `You are Cappo, the AI operations engine for Apex Meridian Group (AMG). You work UNDER ALLIE (Rahm's Director of Operations): she delegates AMG tasks to you, and you EXECUTE them in AMG's systems, then report back.

You can read and manage AMG's ClickUp (the AMG space only). Use your tools to pull REAL data and make exactly the changes requested — never invent task names, ids, statuses, or dates; look them up first. New tasks land in the current quarter's Agenda. When finished, give a tight summary of what you found and what you changed, including task ids, so ALLIE can relay it.`;

const TOOLS = [
  {
    name: "amg_list_tasks",
    description:
      "List AMG ClickUp tasks (optionally filtered by a tag). Returns names, statuses, due dates, and ids. Use this to find the right task before changing it.",
    input_schema: {
      type: "object",
      properties: { tag: { type: "string", description: "optional ClickUp tag to filter by" } },
    },
  },
  {
    name: "amg_create_task",
    description:
      "Create a task in the AMG current-quarter Agenda. Provide name; optional tag and due date (YYYY-MM-DD).",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        tag: { type: "string" },
        due: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["name"],
    },
  },
  {
    name: "amg_update_task",
    description:
      "Update an AMG task by id. Provide task_id and any of: name, status (must match the list's statuses), due (YYYY-MM-DD).",
    input_schema: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        name: { type: "string" },
        status: { type: "string" },
        due: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["task_id"],
    },
  },
];

function toMs(due?: string): number | undefined {
  if (!due) return undefined;
  const d = new Date(`${due}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? undefined : d.getTime();
}

async function runTool(name: string, input: Record<string, string>): Promise<string> {
  if (name === "amg_list_tasks") {
    const tasks = await clickupListTasks(input.tag);
    return tasks.length
      ? tasks
          .map((t) => `- [${t.status}] ${t.name} (id ${t.id})${t.due ? ` due ${t.due}` : ""}`)
          .join("\n")
      : "No AMG tasks found.";
  }
  if (name === "amg_create_task") {
    const r = await clickupCreateTask({ name: input.name, tag: input.tag, dueMs: toMs(input.due) });
    return `Created '${input.name}' (id ${r.id}) ${r.url}`;
  }
  if (name === "amg_update_task") {
    return clickupUpdateTask(input.task_id, {
      name: input.name,
      status: input.status,
      dueMs: toMs(input.due),
    });
  }
  return `(unknown tool: ${name})`;
}

export async function runCappoAgent(task: string): Promise<string> {
  const ai = getAnthropic();
  if (!ai) return "Cappo's AI is not configured (no Anthropic key on the AMG side).";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = [{ role: "user", content: `Task from ALLIE: ${task}` }];
  let lastText = "";
  for (let i = 0; i < 7; i++) {
    const resp = await ai.messages.create({
      model: AI_MODEL,
      max_tokens: 1300,
      system: SYSTEM,
      messages,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: TOOLS as any,
    });
    lastText = resp.content
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((b: any) => b.type === "text")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((b: any) => b.text)
      .join("")
      .trim();
    if (resp.stop_reason !== "tool_use") return lastText;

    messages.push({ role: "assistant", content: resp.content });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const b of resp.content as any[]) {
      if (b.type === "tool_use") {
        let out = "";
        try {
          out = await runTool(b.name, b.input || {});
        } catch (e) {
          out = `(tool ${b.name} failed: ${e instanceof Error ? e.message : String(e)})`;
        }
        results.push({ type: "tool_result", tool_use_id: b.id, content: out || "(no result)" });
      }
    }
    messages.push({ role: "user", content: results });
  }
  return lastText || "(Cappo worked on it but couldn't finish cleanly.)";
}
