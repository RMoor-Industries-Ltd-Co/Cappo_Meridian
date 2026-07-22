/**
 * GrantOps approval automation — the "every approved grant scaffolds itself" step.
 *
 * When CAPPO approves an opportunity (approved_to_apply), Cappo:
 *   1. auto-opens the application workspace (checklist) — done in actions.ts,
 *   2. natively creates the ClickUp deadline tasks (createDeadlineTasksForApplication),
 *   3. natively creates the Google Drive folder + draft-doc workspace
 *      (createDriveWorkspace) using the app's already-connected Google account, and
 *      links the folder URL onto the application.
 *
 * Everything here is BEST-EFFORT: an unconfigured/unauthorized integration or a
 * transient outage must never break the approval itself. The Drive folder + ClickUp
 * tasks are the durable source-of-truth records; Cappo's own store is a coordination
 * surface (see store.ts:11).
 */

import { env } from "@/lib/env";
import { clickupCreateTask } from "@/lib/connectors/clickup";
import { driveCreateDoc, driveEnsureFolder, isNotConnected } from "@/lib/connectors/driveFs";
import { DOCUMENT_LABELS, updateApplication } from "./store";
import type { FundingOpportunity, GrantApplication } from "./types";

/** ClickUp tag applied to every task this automation creates. */
const GRANTOPS_TAG = "grantops";

/**
 * The draft Google Docs created inside the grant folder — the "draft workspace."
 * Ordered to mirror a real application's build sequence; each becomes one blank Doc.
 */
const DRAFT_DOC_SECTIONS = [
  "Narrative",
  "Founder Bio",
  "Business Summary",
  "Project Summary",
  "Use of Funds",
  "Budget Narrative",
  "Impact Statement",
] as const;

/** The grant folder's name — stable so re-approval resolves the same folder. */
function folderName(opp: FundingOpportunity): string {
  const date = opp.deadline ? opp.deadline.slice(0, 10) : "rolling";
  return `${date} — ${opp.opportunityName} (${opp.bestApplicantEntity})`;
}

/**
 * Create the Drive workspace for a freshly-approved grant: a folder (search-or-create,
 * so it's idempotent) plus one blank Google Doc per draft section, then link the folder
 * URL onto the application. Best-effort: if Google isn't connected or any call fails,
 * it logs and no-ops — never throws into the approval. Returns the folder URL or null.
 */
export async function createDriveWorkspace(
  opp: FundingOpportunity,
  app: GrantApplication,
): Promise<string | null> {
  try {
    const parentId = env.GRANTOPS_DRIVE_PARENT_FOLDER_ID || "root";
    const folder = await driveEnsureFolder(folderName(opp), parentId);

    // Draft docs in parallel; a single doc failing must not sink the rest.
    await Promise.all(
      DRAFT_DOC_SECTIONS.map((section) =>
        driveCreateDoc(section, folder.id).catch((err) => {
          console.error(
            "[grantops] draft doc failed:",
            section,
            err instanceof Error ? err.message : err,
          );
        }),
      ),
    );

    if (folder.webViewLink) updateApplication(app.id, { driveFolderUrl: folder.webViewLink });
    return folder.webViewLink ?? null;
  } catch (err) {
    if (isNotConnected(err)) {
      console.warn("[grantops] Drive not connected — skipping workspace creation");
    } else {
      console.error(
        "[grantops] Drive workspace failed:",
        err instanceof Error ? err.message : err,
      );
    }
    return null;
  }
}

/**
 * Create the ClickUp deadline tasks for a freshly-approved grant: one "Submit" task
 * due on the deadline, plus one "Gather" task per required document. Best-effort and
 * individually guarded — ClickUp being unconfigured or a single task failing must not
 * abort the rest or the approval. Returns the count created.
 */
export async function createDeadlineTasksForApplication(
  opp: FundingOpportunity,
): Promise<number> {
  if (!env.CLICKUP_API_TOKEN) return 0;
  const dueMs = opp.deadline ? new Date(opp.deadline).getTime() : null;
  const validDue = dueMs !== null && Number.isFinite(dueMs) ? dueMs : null;

  const tasks: { name: string; dueMs: number | null }[] = [
    { name: `Submit: ${opp.opportunityName} (${opp.fundingOrganization})`, dueMs: validDue },
    ...opp.requiredDocuments.map((dt) => ({
      name: `Gather: ${DOCUMENT_LABELS[dt] ?? dt} — ${opp.opportunityName}`,
      dueMs: validDue,
    })),
  ];

  let created = 0;
  for (const t of tasks) {
    try {
      await clickupCreateTask({ name: t.name, tag: GRANTOPS_TAG, dueMs: t.dueMs });
      created += 1;
    } catch (err) {
      console.error("[grantops] ClickUp task failed:", err instanceof Error ? err.message : err);
    }
  }
  return created;
}
