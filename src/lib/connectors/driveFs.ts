import { Readable } from "node:stream";
import { google, type drive_v3 } from "googleapis";
import { getAuthorizedClient } from "./google";

/**
 * Google Drive file operations backing the Drive module (CRUD).
 * Requires the Drive connector to be authorized (full `drive` scope).
 */

export const FOLDER_MIME = "application/vnd.google-apps.folder";

export interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  iconLink?: string;
}

export interface Crumb {
  id: string;
  name: string;
}

class NotConnectedError extends Error {
  constructor() {
    super("Google Drive not connected");
    this.name = "NotConnectedError";
  }
}

async function client(): Promise<drive_v3.Drive> {
  const auth = await getAuthorizedClient();
  if (!auth) throw new NotConnectedError();
  return google.drive({ version: "v3", auth });
}

export function isNotConnected(err: unknown): boolean {
  return err instanceof NotConnectedError;
}

function toItem(f: drive_v3.Schema$File): DriveItem {
  return {
    id: f.id!,
    name: f.name ?? "Untitled",
    mimeType: f.mimeType ?? "application/octet-stream",
    isFolder: f.mimeType === FOLDER_MIME,
    modifiedTime: f.modifiedTime ?? undefined,
    size: f.size ?? undefined,
    webViewLink: f.webViewLink ?? undefined,
    iconLink: f.iconLink ?? undefined,
  };
}

export interface LegalGroup {
  key: string;
  label: string;
  docs: DriveItem[];
}

const LEGAL_ENTITIES: { key: string; label: string; match: RegExp[] }[] = [
  { key: "AMG", label: "AMG — Apex Meridian Group", match: [/\bamg\b/i, /apex\s*meridian/i] },
  { key: "HVN", label: "HVN — Havenry", match: [/\bhvn\b/i, /havenry/i] },
  { key: "3E", label: "3E Dynamics", match: [/\b3e\b/i, /3e\s*dynamics/i] },
  { key: "RMI", label: "RMI — RMoor Industries", match: [/\brmi\b/i, /rmoor/i] },
];

// Pick the entity whose name appears LAST in the string, so a hierarchical title like
// "AMG → HVN Global → HVN - Founders…" resolves to the most-specific entity (HVN), not AMG.
function entityFromName(name: string): string | null {
  let best: { key: string; idx: number } | null = null;
  for (const e of LEGAL_ENTITIES) {
    for (const re of e.match) {
      const m = name.match(re);
      if (m && m.index !== undefined && (!best || m.index > best.idx)) best = { key: e.key, idx: m.index };
    }
  }
  return best ? best.key : null;
}

// The legal-document source folders (owned by admin@apex-meridian-group.com; must be
// shared with the Cappo connector account). Each folder carries a default entity;
// a file/subfolder name can override it to a sub-entity (e.g. 3E inside AMG Legal).
const LEGAL_ROOTS: { id: string; entity: string }[] = [
  { id: "1HF9X4TZ59fVQ2JEPSUCuKGl0I6GA5Mf6", entity: "AMG" }, // "AMG Legal"
  { id: "1p0-3Ekc_dX6aDdA_TB4W8i9bH2fHcvEO", entity: "HVN" }, // "HVN GLOBAL"
];

async function walkLegal(
  drive: drive_v3.Drive,
  folderId: string,
  inherited: string,
  out: { entity: string; item: DriveItem }[],
): Promise<void> {
  let files: drive_v3.Schema$File[];
  try {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "files(id,name,mimeType,modifiedTime,size,webViewLink,iconLink)",
      pageSize: 200,
      orderBy: "name",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    files = res.data.files ?? [];
  } catch {
    return; // folder not accessible (not shared yet) — skip gracefully
  }
  for (const f of files) {
    if (f.mimeType === FOLDER_MIME) {
      await walkLegal(drive, f.id!, entityFromName(f.name ?? "") ?? inherited, out);
    } else {
      out.push({ entity: entityFromName(f.name ?? "") ?? inherited, item: toItem(f) });
    }
  }
}

/**
 * Finalized legal documents, read from the dedicated AMG/HVN Drive folders (recursively)
 * and bucketed per entity (AMG / HVN / 3E / RMI). Entity comes from the file/subfolder name
 * when it names one, else the source folder's default entity.
 */
// Folder in the connector account's Drive where Cappo files signed docs harvested from email.
export const HARVEST_FOLDER = "Legal — Signed (Cappo)";

export async function getLegalDocsByEntity(): Promise<LegalGroup[]> {
  const drive = await client();
  const collected: { entity: string; item: DriveItem }[] = [];
  for (const root of LEGAL_ROOTS) await walkLegal(drive, root.id, root.entity, collected);
  // Include the harvest folder (signed docs filed from email), if it exists.
  try {
    const hv = await drive.files.list({
      q: `name = '${HARVEST_FOLDER}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
      fields: "files(id)",
      pageSize: 1,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    const hid = hv.data.files?.[0]?.id;
    if (hid) await walkLegal(drive, hid, "AMG", collected);
  } catch {
    /* harvest folder absent — ignore */
  }
  const groups: LegalGroup[] = LEGAL_ENTITIES.map((e) => ({ key: e.key, label: e.label, docs: [] }));
  const seen = new Set<string>();
  for (const { entity, item } of collected) {
    const key = item.name.trim().toLowerCase();
    if (seen.has(key)) continue; // collapse the same doc appearing in more than one source folder
    seen.add(key);
    (groups.find((g) => g.key === entity) ?? groups[0]).docs.push(item);
  }
  return groups;
}

/** Find a folder by name under a parent, creating it if missing. */
export async function driveEnsureFolder(name: string, parentId = "root"): Promise<DriveItem> {
  const drive = await client();
  const res = await drive.files.list({
    q: `name = '${name.replace(/'/g, "\\'")}' and mimeType = '${FOLDER_MIME}' and '${parentId}' in parents and trashed = false`,
    fields: "files(id,name,mimeType,modifiedTime,webViewLink,iconLink)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const found = res.data.files?.[0];
  return found ? toItem(found) : driveCreateFolder(name, parentId);
}

/** List children of a folder (folders first, then files by name). */
export async function driveList(parentId = "root"): Promise<DriveItem[]> {
  const drive = await client();
  const { data } = await drive.files.list({
    q: `'${parentId}' in parents and trashed = false`,
    orderBy: "folder,name",
    pageSize: 500,
    fields: "files(id,name,mimeType,modifiedTime,size,webViewLink,iconLink)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return (data.files ?? []).map(toItem);
}

/** Breadcrumb trail from the given folder up to My Drive. */
export async function driveBreadcrumbs(folderId: string): Promise<Crumb[]> {
  if (!folderId || folderId === "root") return [{ id: "root", name: "My Drive" }];
  const drive = await client();
  const trail: Crumb[] = [];
  let current: string | undefined = folderId;
  // Walk up parents (cap depth to avoid loops).
  for (let i = 0; i < 25 && current && current !== "root"; i++) {
    const res = await drive.files.get({
      fileId: current,
      fields: "id,name,parents",
      supportsAllDrives: true,
    });
    const f: drive_v3.Schema$File = res.data;
    trail.unshift({ id: f.id!, name: f.name ?? "…" });
    current = f.parents?.[0] ?? undefined;
  }
  trail.unshift({ id: "root", name: "My Drive" });
  return trail;
}

export async function driveCreateFolder(name: string, parentId = "root"): Promise<DriveItem> {
  const drive = await client();
  const { data } = await drive.files.create({
    requestBody: { name, mimeType: FOLDER_MIME, parents: [parentId] },
    fields: "id,name,mimeType,modifiedTime,webViewLink,iconLink",
    supportsAllDrives: true,
  });
  return toItem(data);
}

export async function driveRename(fileId: string, name: string): Promise<DriveItem> {
  const drive = await client();
  const { data } = await drive.files.update({
    fileId,
    requestBody: { name },
    fields: "id,name,mimeType,modifiedTime,webViewLink,iconLink",
    supportsAllDrives: true,
  });
  return toItem(data);
}

/** Move to trash (recoverable) rather than hard-delete. */
export async function driveTrash(fileId: string): Promise<void> {
  const drive = await client();
  await drive.files.update({
    fileId,
    requestBody: { trashed: true },
    supportsAllDrives: true,
  });
}

/** Full-text search across Drive files (name or content). */
export async function driveSearch(query: string, maxResults = 20): Promise<DriveItem[]> {
  const drive = await client();
  const q = `fullText contains '${query.replace(/'/g, "\\'")}' and trashed = false`;
  const { data } = await drive.files.list({
    q,
    orderBy: "relevance",
    pageSize: maxResults,
    fields: "files(id,name,mimeType,modifiedTime,size,webViewLink,iconLink)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return (data.files ?? []).map(toItem);
}

export async function driveUpload(
  parentId: string,
  name: string,
  mimeType: string,
  body: Buffer,
): Promise<DriveItem> {
  const drive = await client();
  const { data } = await drive.files.create({
    requestBody: { name, parents: [parentId] },
    media: { mimeType: mimeType || "application/octet-stream", body: Readable.from(body) },
    fields: "id,name,mimeType,modifiedTime,size,webViewLink,iconLink",
    supportsAllDrives: true,
  });
  return toItem(data);
}

/** Create a blank Google Doc in the folder. */
export async function driveCreateDoc(name: string, parentId = "root"): Promise<DriveItem> {
  const drive = await client();
  const { data } = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.document",
      parents: [parentId],
    },
    fields: "id,name,mimeType,modifiedTime,webViewLink,iconLink",
    supportsAllDrives: true,
  });
  return toItem(data);
}
