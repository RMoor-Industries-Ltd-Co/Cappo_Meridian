import Anthropic from "@anthropic-ai/sdk";
import { Client as NotionClient } from "@notionhq/client";
import { env } from "@/lib/env";
import {
  clickupListTasks,
  clickupCreateTask,
  clickupUpdateTask,
  clickupCalendarEvents,
} from "@/lib/connectors/clickup";
import {
  gmailSearch,
  gmailEnsureLabel,
  gmailModify,
  gmailTrash,
  gmailCreateDraft,
  gmailSend,
} from "@/lib/connectors/gmail";
import { driveList, driveSearch } from "@/lib/connectors/driveFs";

const AI_MODEL = "claude-sonnet-4-6";

function getAnthropic(): Anthropic | null {
  const key = env.ANTHROPIC_API_KEY || env.CLAUDE_API_KEY;
  return key ? new Anthropic({ apiKey: key }) : null;
}

function getNotion(): NotionClient | null {
  return env.NOTION_API_KEY ? new NotionClient({ auth: env.NOTION_API_KEY }) : null;
}

/** Best-effort title from a Notion page's properties. */
function notionPageTitle(page: Record<string, unknown>): string {
  const props = (page.properties ?? {}) as Record<string, unknown>;
  for (const v of Object.values(props)) {
    const val = v as { type?: string; title?: { plain_text: string }[] };
    if (val?.type === "title" && Array.isArray(val.title))
      return val.title.map((t) => t.plain_text).join("") || "Untitled";
  }
  return "Untitled";
}

const SYSTEM = `You are Cappo, the AI operations engine for Apex Meridian Group (AMG). You work UNDER ALLIE (Rahm's Director of Operations): she delegates AMG tasks to you, and you EXECUTE them in AMG's systems, then report back.

You can: read and manage AMG's ClickUp (AMG space only); organise the AMG mailbox (Gmail: search, label, archive, mark-read, trash, draft, send); search and browse AMG's Google Drive; search the AMG Notion workspace; fetch live web pages for research; check the upcoming AMG calendar; and pull Vale's (HVN Havenry's concierge) latest showroom activity report for HVN<->AMG business coordination.

Use your tools to pull REAL data and make exactly the changes requested — never invent names, ids, statuses, or dates. When finished, give a tight summary of what you found and what you changed, including ids.`;

const TOOLS = [
  // ── ClickUp ──────────────────────────────────────────────────────────
  {
    name: "amg_list_tasks",
    description:
      "List AMG ClickUp tasks (optionally filtered by tag). Returns names, statuses, due dates, and ids.",
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
      "Update an AMG task by id. Provide task_id and any of: name, status, due (YYYY-MM-DD).",
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
    name: "amg_calendar",
    description:
      "List upcoming AMG ClickUp calendar events. days_ahead defaults to 14.",
    input_schema: {
      type: "object",
      properties: { days_ahead: { type: "number", description: "how many days ahead (default 14)" } },
    },
  },
  // ── Gmail ─────────────────────────────────────────────────────────────
  {
    name: "gmail_search",
    description:
      "Search the AMG mailbox using Gmail query syntax (e.g. 'from:pandadoc', 'subject:invoice', 'in:inbox is:unread'). Returns id, subject, from, and snippet for each match.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
        max: { type: "number", description: "max results (default 25)" },
      },
      required: ["query"],
    },
  },
  {
    name: "gmail_label",
    description:
      "Apply a label to messages (creating it if needed), optionally archiving them. Provide ids (from gmail_search) and label name.",
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
    description: "Archive messages (remove from inbox). Provide ids.",
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
    description: "Move messages to Trash. Use only when clearly asked to delete. Provide ids.",
    input_schema: {
      type: "object",
      properties: { ids: { type: "array", items: { type: "string" } } },
      required: ["ids"],
    },
  },
  {
    name: "gmail_draft",
    description:
      "Create a Gmail draft. The draft sits in the Drafts folder — no email is sent. Use when the partner wants to compose a message for review first.",
    input_schema: {
      type: "object",
      properties: {
        to: { type: "string", description: "recipient email address" },
        subject: { type: "string" },
        body: { type: "string", description: "plain-text email body" },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "gmail_send",
    description:
      "Send an email immediately from the AMG mailbox. Only use when the partner explicitly confirms they want to send (not just draft).",
    input_schema: {
      type: "object",
      properties: {
        to: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
      },
      required: ["to", "subject", "body"],
    },
  },
  // ── Google Drive ──────────────────────────────────────────────────────
  {
    name: "drive_search",
    description:
      "Search AMG Google Drive for files matching a query (by name or content). Returns file names and links.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
        max: { type: "number", description: "max results (default 20)" },
      },
      required: ["query"],
    },
  },
  {
    name: "drive_browse",
    description:
      "Browse the contents of a Drive folder. Omit folder_id to list My Drive root. Returns names, types, and links.",
    input_schema: {
      type: "object",
      properties: { folder_id: { type: "string", description: "Drive folder id (default: root)" } },
    },
  },
  // ── Notion ────────────────────────────────────────────────────────────
  {
    name: "notion_search",
    description:
      "Search the AMG Notion workspace for pages matching a query. Returns page titles and links.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
        max: { type: "number", description: "max results (default 15)" },
      },
      required: ["query"],
    },
  },
  {
    name: "notion_capture",
    description:
      "Add a quick idea, note, or capture to Notion. Creates a new page under the AMG workspace with the given title and content.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        content: { type: "string", description: "body text for the page" },
        parent_page_id: {
          type: "string",
          description: "parent Notion page id (optional — creates at workspace root if omitted)",
        },
      },
      required: ["title", "content"],
    },
  },
  // ── Vale (HVN Havenry) ───────────────────────────────────────────────
  {
    name: "vale_get_report",
    description:
      "Pull Vale's latest cached HVN Havenry showroom activity report -- already generated on a schedule, instant to read. For HVN<->AMG business coordination: what's trending in the showroom, which products are getting attention. Aggregate data only, never a specific visitor's conversation.",
    input_schema: { type: "object", properties: {} },
  },
  // ── Web ───────────────────────────────────────────────────────────────
  {
    name: "web_fetch",
    description:
      "Fetch a public web page and return its visible text content (up to ~5 000 chars). Use for live research: company sites, news articles, pricing pages, LinkedIn profiles, etc.",
    input_schema: {
      type: "object",
      properties: { url: { type: "string", description: "full URL to fetch (https://...)" } },
      required: ["url"],
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
  // ── ClickUp ──────────────────────────────────────────────────────────
  if (name === "amg_list_tasks") {
    const tasks = await clickupListTasks(input.tag);
    return tasks.length
      ? tasks.map((t) => `- [${t.status}] ${t.name} (id ${t.id})${t.due ? ` due ${t.due}` : ""}`).join("\n")
      : "No AMG tasks found.";
  }
  if (name === "amg_create_task") {
    const r = await clickupCreateTask({ name: input.name, tag: input.tag, dueMs: toMs(input.due) });
    return `Created '${input.name}' (id ${r.id}) ${r.url}`;
  }
  if (name === "amg_update_task") {
    return clickupUpdateTask(input.task_id, { name: input.name, status: input.status, dueMs: toMs(input.due) });
  }
  if (name === "amg_calendar") {
    const days = Number(input.days_ahead ?? 14);
    const now = Date.now();
    const events = await clickupCalendarEvents(now, now + days * 86_400_000);
    if (!events.length) return "No upcoming AMG calendar events.";
    return events
      .map((e) => `- ${e.title} · ${e.start.slice(0, 10)}${e.allDay ? "" : " " + e.start.slice(11, 16)} [${e.status ?? ""}] ${e.url ?? ""}`)
      .join("\n");
  }
  // ── Gmail ─────────────────────────────────────────────────────────────
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
  if (name === "gmail_draft") {
    const id = await gmailCreateDraft(input.to, input.subject, input.body);
    return `Draft created (id ${id}) — ready to review and send in Gmail.`;
  }
  if (name === "gmail_send") {
    const id = await gmailSend(input.to, input.subject, input.body);
    return `Email sent to ${input.to} (message id ${id}).`;
  }
  // ── Google Drive ──────────────────────────────────────────────────────
  if (name === "drive_search") {
    const items = await driveSearch(input.query, input.max ? Number(input.max) : 20);
    if (!items.length) return "No matching files found in Drive.";
    return items
      .map((f) => `- ${f.isFolder ? "📁" : "📄"} ${f.name}${f.webViewLink ? ` — ${f.webViewLink}` : ""}`)
      .join("\n");
  }
  if (name === "drive_browse") {
    const items = await driveList(input.folder_id ?? "root");
    if (!items.length) return "Folder is empty.";
    return items
      .map((f) => `- ${f.isFolder ? "📁" : "📄"} ${f.name}${f.webViewLink ? ` — ${f.webViewLink}` : ""}`)
      .join("\n");
  }
  // ── Notion ────────────────────────────────────────────────────────────
  if (name === "notion_search") {
    const notion = getNotion();
    if (!notion) return "(Notion not configured — NOTION_API_KEY missing)";
    const max = Number(input.max ?? 15);
    const res = await notion.search({
      query: input.query,
      sort: { direction: "descending", timestamp: "last_edited_time" },
      page_size: max,
      filter: { property: "object", value: "page" },
    });
    if (!res.results.length) return "No matching Notion pages.";
    return res.results
      .map((r) => {
        const page = r as Record<string, unknown>;
        return `- ${notionPageTitle(page)}${page.url ? ` — ${page.url}` : ""}`;
      })
      .join("\n");
  }
  if (name === "notion_capture") {
    const notion = getNotion();
    if (!notion) return "(Notion not configured — NOTION_API_KEY missing)";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parent: any = input.parent_page_id
      ? { type: "page_id", page_id: input.parent_page_id }
      : { type: "workspace", workspace: true };
    const page = await notion.pages.create({
      parent,
      properties: {
        title: { title: [{ text: { content: input.title } }] },
      },
      children: [
        {
          object: "block",
          type: "paragraph",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          paragraph: { rich_text: [{ text: { content: input.content } }] } as any,
        },
      ],
    });
    return `Notion page created: "${input.title}" — ${(page as Record<string, unknown>).url ?? page.id}`;
  }
  // ── Web ───────────────────────────────────────────────────────────────
  if (name === "vale_get_report") {
    if (!env.VALE_REPORT_URL || !env.VALE_AGENT_KEY) return "Vale's cached report isn't connected yet.";
    try {
      const res = await fetch(env.VALE_REPORT_URL, {
        headers: { "x-agent-key": env.VALE_AGENT_KEY },
        signal: AbortSignal.timeout(15_000),
      });
      if (res.status === 401) return "Vale rejected the call (auth key mismatch).";
      if (!res.ok) return `HTTP ${res.status} ${res.statusText} from Vale`;
      const data = (await res.json()) as { reportText?: string | null; report_text?: string | null };
      return data.reportText ?? data.report_text ?? "(no report cached yet)";
    } catch (e) {
      return `Vale report pull failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  if (name === "web_fetch") {
    try {
      const res = await fetch(input.url, {
        headers: { "User-Agent": "Cappo-AMG/1.0 (research bot)" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return `HTTP ${res.status} ${res.statusText} from ${input.url}`;
      const html = await res.text();
      // Strip tags, collapse whitespace, truncate
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 5_000);
      return text || "(page returned no text content)";
    } catch (e) {
      return `Failed to fetch ${input.url}: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  return `(unknown tool: ${name})`;
}

const SYSTEM_DASH = `You are Cappo, the AI operations engine for Apex Meridian Group (AMG), talking directly with an AMG partner in the Cappo dashboard.

You have full access to AMG's operational systems and will act on requests automatically — no need for the partner to enable a special mode.

Your capabilities:
• ClickUp — list, create, update AMG tasks
• Gmail — search, label, archive, mark-read, trash, draft, and send emails
• Google Drive — search files and browse folders
• Notion — search pages and create new captures/notes
• Calendar — view upcoming AMG events
• Web — fetch live pages for research (company sites, news, pricing, etc.)
• Vale — pull HVN Havenry's concierge's latest showroom activity report for HVN<->AMG business coordination

When the partner asks you to DO something — create a task, draft an email, find a file, research a company — use your tools and confirm exactly what you did with ids/counts. For email, always gmail_search first to get message ids before acting on them. When they're just thinking or asking questions, help them think. Be concise and direct. Never invent task names, ids, statuses, or dates — look them up first.`;

/** Core tool-use loop shared by the ALLIE-delegation path and the dashboard chat. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runLoop(system: string, seed: any[], model?: string): Promise<string> {
  const ai = getAnthropic();
  if (!ai) return "Cappo's AI is not configured (no Anthropic key on the AMG side).";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = [...seed];
  let lastText = "";
  for (let i = 0; i < 8; i++) {
    const resp = await ai.messages.create({
      model: model || AI_MODEL,
      max_tokens: 4096,
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

/** A multimodal content block sent from the client alongside the last user message. */
export interface AttachmentBlock {
  type: "image" | "document" | "text";
  mimeType?: string;
  base64?: string;    // for image / document blocks
  content?: string;   // for inline text/code blocks
  name: string;
}

/** ALLIE delegation: a single self-contained AMG task. */
export function runCappoAgent(task: string): Promise<string> {
  return runLoop(SYSTEM, [{ role: "user", content: `Task from ALLIE: ${task}` }]);
}

/** Dashboard chat: a partner conversation — tools always available, Cappo acts automatically. */
export function runCappoAgentChat(
  history: { role: "user" | "assistant"; content: string }[],
  options?: { model?: string; attachmentBlocks?: AttachmentBlock[] },
): Promise<string> {
  const filtered = history
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content)
    .slice(-20);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seed: any[] = filtered.map((m, i) => {
    // Inject multimodal blocks into the last user message
    if (i === filtered.length - 1 && m.role === "user" && options?.attachmentBlocks?.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blocks: any[] = options.attachmentBlocks.map((b) => {
        if (b.type === "image" && b.base64 && b.mimeType) {
          return { type: "image", source: { type: "base64", media_type: b.mimeType, data: b.base64 } };
        }
        if (b.type === "document" && b.base64) {
          return { type: "document", source: { type: "base64", media_type: "application/pdf", data: b.base64 }, title: b.name };
        }
        // text/code: inline as a text block
        return { type: "text", text: `\`\`\`\n// ${b.name}\n${b.content ?? ""}\n\`\`\`` };
      });
      blocks.push({ type: "text", text: m.content });
      return { role: "user", content: blocks };
    }
    return { role: m.role, content: m.content };
  });

  return runLoop(SYSTEM_DASH, seed, options?.model);
}
