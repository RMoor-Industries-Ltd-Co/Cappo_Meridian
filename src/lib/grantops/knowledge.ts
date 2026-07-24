/**
 * GrantOps entity knowledge bank (Google Drive).
 *
 * The AMG legal Drive folder is the source of truth for entity context. Each entity
 * gets a subfolder under the knowledge root; partners drop legal/registration/summary
 * documents there, and Cappo reads their text when pre-writing grant drafts and the
 * pre-application briefing — so the thinly-documented entities (3E, RMG, GovernanceIQ,
 * the founders) become as well-grounded as HVN/AMG.
 *
 * Everything is best-effort: a not-connected Drive yields an empty listing / empty
 * context and never breaks the caller.
 */

import { env } from "@/lib/env";
import {
  driveEnsureFolder,
  driveExportText,
  driveList,
  isNotConnected,
  type DriveItem,
} from "@/lib/connectors/driveFs";
import type { EntityProfile } from "./types";

// The AMG legal Drive folder the user designated as the knowledge bank. Overridable
// via env for other deployments; defaults to that folder id.
const DEFAULT_KNOWLEDGE_ROOT = "1NFuVCiSEi_vxY-3A_fSALRxZwHKgbSBg";

export function knowledgeRootId(): string {
  return env.GRANTOPS_KNOWLEDGE_FOLDER_ID || DEFAULT_KNOWLEDGE_ROOT;
}

/** The per-entity subfolder name under the knowledge root. Stable so it resolves back. */
function entityFolderName(e: EntityProfile): string {
  return `${e.entityCode} — ${e.shortName || e.entityName}`;
}

/** Extract a Drive folder id from a raw id or a Drive URL (…/folders/<id>, …/d/<id>). */
export function parseFolderId(input: string | null | undefined): string | null {
  const s = (input ?? "").trim();
  if (!s) return null;
  const m = s.match(/\/folders\/([A-Za-z0-9_-]+)/) || s.match(/\/d\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : s.split(/[?#]/)[0];
}

/** Parsed GRANTOPS_ENTITY_FOLDERS map (EntityCode → folder id), or {} if unset/invalid. */
function envFolderMap(): Record<string, string> {
  if (!env.GRANTOPS_ENTITY_FOLDERS) return {};
  try {
    const obj = JSON.parse(env.GRANTOPS_ENTITY_FOLDERS);
    return obj && typeof obj === "object" ? (obj as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/**
 * An explicit folder id for this entity, if any: the entity's own knowledgeFolderId
 * (set in the UI) takes precedence, then the GRANTOPS_ENTITY_FOLDERS env map. Null
 * means "no override — use the auto-created subfolder under the knowledge root."
 */
function entityFolderOverride(e: EntityProfile): string | null {
  return parseFolderId(e.knowledgeFolderId) || envFolderMap()[e.entityCode] || null;
}

export interface EntityFolder {
  id: string;
  name: string;
  webViewLink?: string;
}

/**
 * Resolve the entity's knowledge folder. With an override id (e.g. RMI → the shared
 * RECORDS BOOK folder) Cappo reads THAT folder directly — no create. Otherwise it
 * finds-or-creates a `{code} — {name}` subfolder under the knowledge root.
 */
export async function resolveEntityFolder(e: EntityProfile): Promise<EntityFolder> {
  const override = entityFolderOverride(e);
  if (override) {
    return {
      id: override,
      name: entityFolderName(e),
      webViewLink: `https://drive.google.com/drive/folders/${override}`,
    };
  }
  const folder = await driveEnsureFolder(entityFolderName(e), knowledgeRootId());
  return { id: folder.id, name: folder.name, webViewLink: folder.webViewLink };
}

export interface KnowledgeListing {
  connected: boolean;
  folderId?: string;
  folderUrl?: string;
  files: DriveItem[];
}

/** List the files in an entity's knowledge folder (for the Entities-page panel). */
export async function listEntityKnowledge(e: EntityProfile): Promise<KnowledgeListing> {
  try {
    const folder = await resolveEntityFolder(e);
    const files = await driveList(folder.id);
    return { connected: true, folderId: folder.id, folderUrl: folder.webViewLink, files };
  } catch (err) {
    if (isNotConnected(err)) return { connected: false, files: [] };
    throw err;
  }
}

// Ingestion budget — keep the prompt sane regardless of how much is in the folder.
// Sized to hold a governance record set (e.g. RMI's Records Book) without runaway tokens.
const MAX_FILES = 10;
const MAX_CHARS = 18_000;

/**
 * Concatenate the readable text of an entity's Drive documents, capped to a budget,
 * for injection into a Cappo prompt. Returns "" when Drive is unconnected, the folder
 * is empty, or nothing has extractable text.
 */
export async function readEntityKnowledge(e: EntityProfile): Promise<string> {
  try {
    const folder = await resolveEntityFolder(e);
    const files = (await driveList(folder.id)).filter((f) => !f.isFolder);
    let out = "";
    for (const f of files.slice(0, MAX_FILES)) {
      if (out.length >= MAX_CHARS) break;
      const text = (await driveExportText(f.id, f.mimeType).catch(() => "")).trim();
      if (!text) continue;
      const chunk = `\n--- ${f.name} ---\n${text}`;
      out += chunk.slice(0, MAX_CHARS - out.length);
    }
    return out.trim();
  } catch {
    return "";
  }
}
