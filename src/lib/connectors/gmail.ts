import { google, type gmail_v1 } from "googleapis";
import { isGoogleConfigured } from "@/lib/env";
import type { ConnectorStatus, UnifiedItem } from "@/lib/types";
import { type Connector, notConfigured } from "./connector";
import { getAuthorizedClient } from "./google";

function header(
  headers: { name?: string | null; value?: string | null }[] | undefined,
  name: string,
): string | undefined {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? undefined;
}

export const gmailConnector: Connector = {
  id: "gmail",
  name: "Gmail",

  isConfigured: () => isGoogleConfigured(),

  async checkConnection(): Promise<ConnectorStatus> {
    if (!this.isConfigured()) {
      return notConfigured(this.id, this.name, "Google OAuth not configured");
    }
    const auth = await getAuthorizedClient();
    if (!auth) {
      return {
        id: this.id,
        name: this.name,
        configured: true,
        connected: false,
        detail: "Not connected — authorize Google to enable Gmail",
      };
    }
    try {
      const gmail = google.gmail({ version: "v1", auth });
      const { data } = await gmail.users.getProfile({ userId: "me" });
      return {
        id: this.id,
        name: this.name,
        configured: true,
        connected: true,
        detail: `Connected as ${data.emailAddress} (${data.messagesTotal ?? 0} messages)`,
      };
    } catch (err) {
      return {
        id: this.id,
        name: this.name,
        configured: true,
        connected: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },

  async listRecent(limit = 25): Promise<UnifiedItem[]> {
    const auth = await getAuthorizedClient();
    if (!auth) return [];
    const gmail = google.gmail({ version: "v1", auth });

    const list = await gmail.users.messages.list({
      userId: "me",
      maxResults: limit,
      q: "in:inbox",
    });

    const messages = list.data.messages ?? [];
    const items = await Promise.all(
      messages.map(async (m) => {
        const { data } = await gmail.users.messages.get({
          userId: "me",
          id: m.id!,
          format: "metadata",
          metadataHeaders: ["Subject", "From", "Date"],
        });
        const headers = data.payload?.headers ?? undefined;
        return {
          id: m.id!,
          source: "gmail" as const,
          kind: "message" as const,
          title: header(headers, "Subject") ?? "(no subject)",
          url: `https://mail.google.com/mail/u/0/#inbox/${m.id}`,
          updatedAt: data.internalDate
            ? new Date(Number(data.internalDate)).toISOString()
            : undefined,
          meta: { from: header(headers, "From"), snippet: data.snippet },
        } satisfies UnifiedItem;
      }),
    );
    return items;
  },
};

// ──────────────────────────────────────────────────────────────
// Organization helpers (require the gmail.modify scope). Used by Cappo's agent
// to search, label, archive, mark-read, and trash email.
// ──────────────────────────────────────────────────────────────

async function gmailClient() {
  const auth = await getAuthorizedClient();
  if (!auth) return null;
  return google.gmail({ version: "v1", auth });
}

export async function gmailSearch(
  query: string,
  max = 25,
): Promise<{ id: string; subject: string; from: string; snippet: string }[]> {
  const gmail = await gmailClient();
  if (!gmail) return [];
  const list = await gmail.users.messages.list({ userId: "me", maxResults: max, q: query || "in:inbox" });
  const msgs = list.data.messages ?? [];
  return Promise.all(
    msgs.map(async (m) => {
      const { data } = await gmail.users.messages.get({
        userId: "me",
        id: m.id!,
        format: "metadata",
        metadataHeaders: ["Subject", "From"],
      });
      const h = data.payload?.headers ?? undefined;
      return {
        id: m.id!,
        subject: header(h, "Subject") ?? "(no subject)",
        from: header(h, "From") ?? "",
        snippet: data.snippet ?? "",
      };
    }),
  );
}

export async function gmailListLabels(): Promise<{ id: string; name: string }[]> {
  const gmail = await gmailClient();
  if (!gmail) return [];
  const { data } = await gmail.users.labels.list({ userId: "me" });
  return (data.labels ?? []).map((l) => ({ id: l.id!, name: l.name! }));
}

/** Find a label by name (case-insensitive) or create it; returns its id. */
export async function gmailEnsureLabel(name: string): Promise<string> {
  const gmail = await gmailClient();
  if (!gmail) throw new Error("Gmail not connected");
  const existing = (await gmailListLabels()).find((l) => l.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;
  const { data } = await gmail.users.labels.create({
    userId: "me",
    requestBody: { name, labelListVisibility: "labelShow", messageListVisibility: "show" },
  });
  return data.id!;
}

export async function gmailModify(ids: string[], add: string[] = [], remove: string[] = []): Promise<void> {
  const gmail = await gmailClient();
  if (!gmail) throw new Error("Gmail not connected");
  if (!ids.length) return;
  await gmail.users.messages.batchModify({
    userId: "me",
    requestBody: { ids, addLabelIds: add, removeLabelIds: remove },
  });
}

export async function gmailTrash(ids: string[]): Promise<void> {
  const gmail = await gmailClient();
  if (!gmail) throw new Error("Gmail not connected");
  for (const id of ids) await gmail.users.messages.trash({ userId: "me", id });
}

/** RFC 2047 encode a header value when it isn't plain ASCII. */
function encodeHeader(value: string): string {
  return /^[\x20-\x7E]*$/.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

/**
 * Build a message. With `html`, emits multipart/alternative so rich clients
 * render the HTML while text-only clients still get a readable body; without
 * it, a plain text/plain message exactly as before.
 */
function buildRawMime(to: string, subject: string, body: string, html?: string): string {
  const head = [`To: ${to}`, `Subject: ${encodeHeader(subject)}`, `MIME-Version: 1.0`];
  const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64").replace(/(.{76})/g, "$1\r\n");

  if (!html) {
    const lines = [
      ...head,
      `Content-Type: text/plain; charset="UTF-8"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      b64(body),
    ].join("\r\n");
    return Buffer.from(lines).toString("base64url");
  }

  const boundary = `cappo-${Buffer.from(subject).toString("hex").slice(0, 16)}-bnd`;
  const lines = [
    ...head,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    b64(body),
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    b64(html),
    ``,
    `--${boundary}--`,
    ``,
  ].join("\r\n");
  return Buffer.from(lines).toString("base64url");
}

/** Create a Gmail draft. Returns the draft id. */
export async function gmailCreateDraft(
  to: string,
  subject: string,
  body: string,
  html?: string,
): Promise<string> {
  const gmail = await gmailClient();
  if (!gmail) throw new Error("Gmail not connected");
  const { data } = await gmail.users.drafts.create({
    userId: "me",
    requestBody: { message: { raw: buildRawMime(to, subject, body, html) } },
  });
  return data.id ?? "";
}

/** Send an email immediately. Returns the sent message id. */
export async function gmailSend(
  to: string,
  subject: string,
  body: string,
  html?: string,
): Promise<string> {
  const gmail = await gmailClient();
  if (!gmail) throw new Error("Gmail not connected");
  const { data } = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: buildRawMime(to, subject, body, html) },
  });
  return data.id ?? "";
}

function flattenParts(payload?: gmail_v1.Schema$MessagePart): gmail_v1.Schema$MessagePart[] {
  if (!payload) return [];
  let out = [payload];
  for (const p of payload.parts ?? []) out = out.concat(flattenParts(p));
  return out;
}

export interface GmailMessageBody {
  id: string;
  subject: string;
  from: string;
  date: string;
  /** Decoded text/plain body when present, else the stripped text/html body. */
  text: string;
  /** Raw text/html body, for link extraction. */
  html: string;
}

function decodePart(p?: gmail_v1.Schema$MessagePart): string {
  const data = p?.body?.data;
  return data ? Buffer.from(data, "base64url").toString("utf8") : "";
}

/**
 * Fetch full message bodies for a Gmail search. Meeting-notification emails are
 * the one signal common to every transcription service, so this is the entry
 * point for all four ingestion sources.
 */
export async function gmailFetchBodies(query: string, max = 25): Promise<GmailMessageBody[]> {
  const gmail = await gmailClient();
  if (!gmail) return [];
  const list = await gmail.users.messages.list({ userId: "me", maxResults: max, q: query });
  const out: GmailMessageBody[] = [];
  for (const m of list.data.messages ?? []) {
    const { data } = await gmail.users.messages.get({ userId: "me", id: m.id!, format: "full" });
    const parts = flattenParts(data.payload ?? undefined);
    const h = data.payload?.headers ?? undefined;
    const html = parts.filter((p) => p.mimeType === "text/html").map(decodePart).join("\n");
    const plain = parts.filter((p) => p.mimeType === "text/plain").map(decodePart).join("\n");
    out.push({
      id: m.id!,
      subject: header(h, "Subject") ?? "(no subject)",
      from: header(h, "From") ?? "",
      date: data.internalDate
        ? new Date(Number(data.internalDate)).toISOString()
        : new Date().toISOString(),
      text: (plain || stripHtml(html)).trim(),
      html,
    });
  }
  return out;
}

/** Crude tag-strip — good enough to turn a notification email into readable text. */
function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n");
}

/** Pull the signed-copy PDF attachments (e.g. PandaDoc) from the mailbox, deduped by filename. */
export async function gmailFetchSignedDocs(
  max = 50,
): Promise<{ filename: string; mimeType: string; data: Buffer }[]> {
  const gmail = await gmailClient();
  if (!gmail) return [];
  const list = await gmail.users.messages.list({
    userId: "me",
    maxResults: max,
    q: 'has:attachment filename:pdf subject:"signed copy"',
  });
  const out: { filename: string; mimeType: string; data: Buffer }[] = [];
  const seen = new Set<string>();
  for (const m of list.data.messages ?? []) {
    const msg = await gmail.users.messages.get({ userId: "me", id: m.id!, format: "full" });
    for (const p of flattenParts(msg.data.payload ?? undefined)) {
      const fn = p.filename ?? "";
      const attId = p.body?.attachmentId;
      if (!fn || !attId || !fn.toLowerCase().endsWith(".pdf") || seen.has(fn)) continue;
      const att = await gmail.users.messages.attachments.get({ userId: "me", messageId: m.id!, id: attId });
      out.push({
        filename: fn,
        mimeType: p.mimeType ?? "application/pdf",
        data: Buffer.from(att.data.data ?? "", "base64url"),
      });
      seen.add(fn);
    }
  }
  return out;
}
