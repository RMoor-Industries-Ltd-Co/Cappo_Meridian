import { gmailFetchSignedDocs } from "@/lib/connectors/gmail";
import { driveEnsureFolder, driveList, driveUpload, HARVEST_FOLDER } from "@/lib/connectors/driveFs";

/**
 * Sweep the mailbox for signed-copy PDFs (e.g. PandaDoc) and file them into a Drive folder
 * in the connector account, deduped by filename. The /legal view reads this folder too, so
 * harvested docs (3E, etc.) appear bucketed by entity. Returns how many were filed vs skipped.
 */
export async function harvestSignedDocs(): Promise<{ filed: number; skipped: number; total: number }> {
  const docs = await gmailFetchSignedDocs();
  const folder = await driveEnsureFolder(HARVEST_FOLDER, "root");
  const existing = new Set((await driveList(folder.id)).map((f) => f.name));
  let filed = 0;
  let skipped = 0;
  for (const d of docs) {
    if (existing.has(d.filename)) {
      skipped++;
      continue;
    }
    await driveUpload(folder.id, d.filename, d.mimeType, d.data);
    existing.add(d.filename);
    filed++;
  }
  return { filed, skipped, total: docs.length };
}
