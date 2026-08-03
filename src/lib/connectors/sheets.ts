import { google, type sheets_v4 } from "googleapis";
import { getArchiveClient } from "./google";

/**
 * Google Sheets access for the meeting archive's spreadsheet.
 *
 * The spreadsheet is the archive's DATABASE — one row per meeting, plus the
 * extracted initiative layer and the read-oriented historical view. It is the
 * system of record; Postgres holds a rebuildable cache of the live working set.
 *
 * Needs no scope beyond the full `drive` scope the connector already requests.
 */

class NotConnectedError extends Error {
  constructor() {
    super("Google account not connected");
    this.name = "NotConnectedError";
  }
}

export function isNotConnected(err: unknown): boolean {
  return err instanceof NotConnectedError;
}

const SPREADSHEET_MIME = "application/vnd.google-apps.spreadsheet";

async function clients(): Promise<{ sheets: sheets_v4.Sheets; drive: ReturnType<typeof google.drive> }> {
  const auth = await getArchiveClient();
  if (!auth) throw new NotConnectedError();
  return {
    sheets: google.sheets({ version: "v4", auth }),
    drive: google.drive({ version: "v3", auth }),
  };
}

/**
 * A1 ranges need the sheet name quoted, and a literal apostrophe inside the
 * name doubled. "Q3 'final' notes" is a legal tab name and an illegal range
 * without this.
 */
function a1(tab: string, range?: string): string {
  const quoted = `'${tab.replace(/'/g, "''")}'`;
  return range ? `${quoted}!${range}` : quoted;
}

/**
 * Find the archive spreadsheet inside the given folder by name, creating it if
 * absent. Matching on name (rather than storing an id) keeps the archive
 * self-describing: the folder alone is enough to find everything.
 */
export async function ensureSpreadsheet(name: string, parentFolderId: string): Promise<string> {
  const { drive } = await clients();
  const escaped = name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const { data } = await drive.files.list({
    q: `name = '${escaped}' and mimeType = '${SPREADSHEET_MIME}' and '${parentFolderId}' in parents and trashed = false`,
    fields: "files(id,name)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const found = data.files?.[0]?.id;
  if (found) return found;

  const created = await drive.files.create({
    requestBody: { name, mimeType: SPREADSHEET_MIME, parents: [parentFolderId] },
    fields: "id",
    supportsAllDrives: true,
  });
  if (!created.data.id) throw new Error(`Failed to create spreadsheet "${name}"`);
  return created.data.id;
}

/** Tab titles present in the spreadsheet. */
export async function listTabs(spreadsheetId: string): Promise<string[]> {
  const { sheets } = await clients();
  const { data } = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });
  return (data.sheets ?? []).map((s) => s.properties?.title ?? "").filter(Boolean);
}

/**
 * Create any missing tabs in one batch, then rename the default "Sheet1" out of
 * the way if it's an unused leftover from spreadsheet creation.
 */
export async function ensureTabs(spreadsheetId: string, titles: readonly string[]): Promise<void> {
  const { sheets } = await clients();
  const existing = new Set(await listTabs(spreadsheetId));
  const missing = titles.filter((t) => !existing.has(t));
  if (!missing.length) return;

  // A freshly created spreadsheet has one tab called "Sheet1". Rename it into
  // the first tab we need rather than leaving an empty stub beside it.
  const requests: sheets_v4.Schema$Request[] = [];
  const [first, ...rest] = missing;
  if (existing.has("Sheet1") && existing.size === 1) {
    const { data } = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties(sheetId,title)",
    });
    const stub = data.sheets?.find((s) => s.properties?.title === "Sheet1")?.properties?.sheetId;
    if (stub !== undefined && stub !== null) {
      requests.push({
        updateSheetProperties: {
          properties: { sheetId: stub, title: first },
          fields: "title",
        },
      });
      for (const t of rest) requests.push({ addSheet: { properties: { title: t } } });
    }
  }
  if (!requests.length) {
    for (const t of missing) requests.push({ addSheet: { properties: { title: t } } });
  }

  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
}

/** Read a whole tab as rows of strings. Missing cells come back as "". */
export async function readTab(spreadsheetId: string, tab: string): Promise<string[][]> {
  const { sheets } = await clients();
  try {
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: a1(tab),
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    return (data.values ?? []).map((row) => row.map((c) => (c === null || c === undefined ? "" : String(c))));
  } catch {
    return []; // tab absent — treat as empty rather than failing the caller
  }
}

/** Overwrite the header row, creating it when the tab is empty. */
export async function ensureHeader(
  spreadsheetId: string,
  tab: string,
  headers: readonly string[],
): Promise<void> {
  const { sheets } = await clients();
  const current = await readTab(spreadsheetId, tab);
  const existing = current[0] ?? [];
  const matches =
    existing.length === headers.length && headers.every((h, i) => existing[i] === h);
  if (matches) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: a1(tab, `A1:${colName(headers.length)}1`),
    valueInputOption: "RAW",
    requestBody: { values: [headers as string[]] },
  });
}

/** 1-based column index → A1 column letters (1 → A, 27 → AA). */
export function colName(index: number): string {
  let n = index;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out || "A";
}

export type Row = (string | number | boolean | null)[];

export async function appendRows(spreadsheetId: string, tab: string, rows: Row[]): Promise<void> {
  if (!rows.length) return;
  const { sheets } = await clients();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: a1(tab, "A1"),
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows as unknown[][] },
  });
}

/**
 * Upsert rows keyed by their first column.
 *
 * Re-running ingestion over an overlapping window is normal (the backfill
 * resumes, the forward sweep re-reads a lookback), so writing has to be
 * idempotent: a meeting already in the sheet is updated in place, never
 * appended a second time.
 *
 * Existing rows are updated with one batch call and new rows appended with
 * another, so cost is two requests regardless of row count.
 */
export async function upsertByKey(
  spreadsheetId: string,
  tab: string,
  headers: readonly string[],
  rows: Row[],
): Promise<{ updated: number; appended: number }> {
  if (!rows.length) return { updated: 0, appended: 0 };
  const { sheets } = await clients();
  await ensureHeader(spreadsheetId, tab, headers);

  const current = await readTab(spreadsheetId, tab);
  // Row 1 is the header, so a key found at index i sits on sheet row i + 1.
  const rowByKey = new Map<string, number>();
  for (let i = 1; i < current.length; i++) {
    const key = current[i]?.[0];
    if (key) rowByKey.set(String(key), i + 1);
  }

  const lastCol = colName(headers.length);
  const updates: sheets_v4.Schema$ValueRange[] = [];
  const appends: Row[] = [];

  for (const row of rows) {
    const key = String(row[0] ?? "");
    const at = key ? rowByKey.get(key) : undefined;
    if (at) {
      updates.push({ range: a1(tab, `A${at}:${lastCol}${at}`), values: [row as unknown[]] });
    } else {
      appends.push(row);
      // Guard against the same key appearing twice in one batch: the first
      // occurrence claims the appended slot, later ones update it instead of
      // appending a duplicate.
      if (key) rowByKey.set(key, current.length + appends.length);
    }
  }

  if (updates.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "RAW", data: updates },
    });
  }
  if (appends.length) await appendRows(spreadsheetId, tab, appends);

  return { updated: updates.length, appended: appends.length };
}
