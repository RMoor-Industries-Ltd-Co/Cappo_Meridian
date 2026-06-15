import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import {
  clickupListTasks,
  clickupCreateTask,
  clickupUpdateTask,
} from "@/lib/connectors/clickup";
import {
  gmailSearch,
  gmailEnsureLabel,
  gmailModify,
  gmailTrash,
} from "@/lib/connectors/gmail";

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

You can read and manage AMG's ClickUp (the AMG space only) AND organize the AMG mailbox (Gmail: search, label, archive, mark-read, trash). Use your tools to pull REAL data and make exactly the changes requested — never invent task names, ids, statuses, or dates; look them up first (for email, gmail_search to get ids before acting). New tasks land in the current quarter's Agenda. When finished, give a tight summary of what you found and what you changed, including ids, so ALLIE can relay it.`;

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
  {
    name: "gmail_search",
    description:
      "Search the connected mailbox using Gmail query syntax (e.g. 'from:pandadoc', 'subject:invoice', 'in:inbox is:unread', 'older_than:30d', 'category:promotions'). Returns id, subject, from, and a snippet for each match. Use this FIRST to find the messages to organize.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" }, max: { type: "number", description: "max results (default 25)" } },
      required: ["query"],
    },
  },
  {
    name: "gmail_label",
    description:
      "Apply a label to messages (creating the label if it doesn't exist), and optionally archive them out of the inbox. Provide ids (from gmail_search) and the label name; set archive=true to also archive.",
    input_schema: {
      type: "object",
      properties: {
        ids: { type: "array", items: { type: "string" } },
        label: { type: "string" },
        archive: { type: "boolean" },
      },
      required: ["ids", "label"],
    },
  },
  {
    name: "gmail_archive",
    description: "Archive messages (remove from inbox, keep in All Mail). Provide ids.",
    input_schema: {
      type: "object",
      properties: { ids: { type: "array", items: { type: "string" } } },
      required: ["ids"],
    },
  },
  {
    name: "gmail_mark_read",
    description: "Mark messages as read. Provide ids.",
    input_schema: {
      type: "object",
      properties: { ids: { type: "array", items: { type: "string" } } },
      required: ["ids"],
    },
  },
  {
    name: "gmail_trash",
    description: "Move messages to Trash (recoverable ~30 days). Provide ids. Use only when clearly asked to delete.",
    input_schema: {
      type: "object",
      properties: { ids: { type: "array", items: { type: "string" } } },
      required: ["ids"],
    },
  },
];

function toMs(due?: string): number | undefined {
  if (!due) return undefined;
  const d = new Date(`${due}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? undefined : d.getTime();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runTool(name: string, input: any): Promise<string> {
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
  if (name === "gmail_search") {
    const r = await gmailSearch(input.query, input.max ? Number(input.max) : 25);
    return r.length
      ? r.map((m) => `[${m.id}] ${m.subject} — ${m.from} — ${m.snippet}`).join("\n")
      : "No matching messages.";
  }
  if (name === "gmail_label") {
    const ids: string[] = input.ids ?? [];
    const labelId = await gmailEnsureLabel(input.label);
    await gmailModify(ids, [labelId], input.archive ? ["INBOX"] : []);
    return `Labeled ${ids.length} message(s) "${input.label}"${input.archive ? " and archived them" : ""}.`;
  }
  if (name === "gmail_archive") {
    const ids: string[] = input.ids ?? [];
    await gmailModify(ids, [], ["INBOX"]);
    return `Archived ${ids.length} message(s).`;
  }
  if (name === "gmail_mark_read") {
    const ids: string[] = input.ids ?? [];
    await gmailModify(ids, [], ["UNREAD"]);
    return `Marked ${ids.length} message(s) read.`;
  }
  if (name === "gmail_trash") {
    const ids: string[] = input.ids ?? [];
    await gmailTrash(ids);
    return `Trashed ${ids.length} message(s).`;
  }
  return `(unknown tool: ${name})`;
}

// Dashboard-facing persona: Cappo talking directly with an AMG partner (not ALLIE delegating).
const SYSTEM_DASH = `You are Cappo, the AI operations engine for Apex Meridian Group (AMG), talking directly with an AMG partner in the Cappo dashboard. Through your tools you can MANAGE AMG's ClickUp (list/create/update tasks) and ORGANIZE the AMG mailbox (Gmail: search, label, archive, mark-read, trash). When the partner asks you to DO something — add a task, set a due date, clean up the inbox, label and archive a batch of emails — use your tools to do it and confirm exactly what you did, with ids/counts. For email, always gmail_search first to get the message ids, then act on them. When they're just thinking or asking, help them think. Be concise and well-structured. Never invent task names, ids, statuses, or dates — look them up first. Only trash email when clearly asked.`;

/** Core tool-use loop shared by the ALLIE-delegation path and the dashboard chat. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runLoop(system: string, seed: any[]): Promise<string> {
  const ai = getAnthropic();
  if (!ai) return "Cappo's AI is not configured (no Anthropic key on the AMG side).";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = [...seed];
  let lastText = "";
  for (let i = 0; i < 7; i++) {
    const resp = await ai.messages.create({
      model: AI_MODEL,
      max_tokens: 1300,
      system,
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

/** ALLIE delegation: a single self-contained AMG task. */
export function runCappoAgent(task: string): Promise<string> {
  return runLoop(SYSTEM, [{ role: "user", content: `Task from ALLIE: ${task}` }]);
}

/** Dashboard chat: a partner conversation where Cappo can also act via tools. */
export function runCappoAgentChat(
  history: { role: "user" | "assistant"; content: string }[],
): Promise<string> {
  const seed = history
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content)
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content }));
  return runLoop(SYSTEM_DASH, seed);
}
