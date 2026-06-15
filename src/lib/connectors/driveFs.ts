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

// A doc counts as "legal" if its name carries one of these markers.
const LEGAL_TERMS =
  /agreement|resolution|operating|\bnda\b|non-?disclosure|assignment|bylaw|articles|license|buy-?sell|certificate|amendment|consent|minutes|incorporat|formation|governance|exhibit|interest confirmation/i;

/**
 * Finalized legal documents from Drive, bucketed per entity (AMG / HVN / 3E / RMI).
 * Searches PDFs + Google Docs whose name carries a legal marker, then groups by the
 * entity named in the filename.
 */
export async function getLegalDocsByEntity(): Promise<LegalGroup[]> {
  const drive = await client();
  const res = await drive.files.list({
    q: "trashed=false and (mimeType='application/pdf' or mimeType='application/vnd.google-apps.document')",
    fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
    orderBy: "name",
    pageSize: 300,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const files = (res.data.files ?? []).map(toItem);
  const groups: LegalGroup[] = LEGAL_ENTITIES.map((e) => ({ key: e.key, label: e.label, docs: [] }));
  for (const f of files) {
    if (!LEGAL_TERMS.test(f.name)) continue;
    const ent = LEGAL_ENTITIES.find((e) => e.match.some((re) => re.test(f.name)));
    if (!ent) continue;
    groups.find((g) => g.key === ent.key)!.docs.push(f);
  }
  return groups;
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
