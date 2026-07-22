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

export interface EntityFolder {
  id: string;
  name: string;
  webViewLink?: string;
}

/** Find (or create) the entity's knowledge subfolder under the root. */
export async function resolveEntityFolder(e: EntityProfile): Promise<EntityFolder> {
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
const MAX_FILES = 8;
const MAX_CHARS = 12_000;

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
