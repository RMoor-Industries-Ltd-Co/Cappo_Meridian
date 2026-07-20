/**
 * GrantOps approval automation — the "every approved grant scaffolds itself" step.
 *
 * When CAPPO approves an opportunity (approved_to_apply), Cappo:
 *   1. auto-opens the application workspace (checklist) — done in actions.ts,
 *   2. natively creates the ClickUp deadline tasks (createDeadlineTasksForApplication),
 *   3. fires a Make.com webhook (fireGrantApprovalWebhook) so Make creates the Drive
 *      folder + draft-doc workspace, then calls back to link the folder URL.
 *
 * Everything here is BEST-EFFORT: an unconfigured integration or a transient outage
 * must never break the approval itself. The Drive folder + ClickUp tasks are the
 * durable source-of-truth records; Cappo's own store is a coordination surface (see
 * store.ts:11), so a fire-and-forget model fits the module's design.
 */

import { env } from "@/lib/env";
import { clickupCreateTask } from "@/lib/connectors/clickup";
import { DOCUMENT_LABELS } from "./store";
import { daysUntil, type FundingOpportunity, type GrantApplication } from "./types";

/** ClickUp tag applied to every task this automation creates. */
const GRANTOPS_TAG = "grantops";

/**
 * The draft Google Docs Make should create inside the grant folder — the "draft
 * workspace." Ordered to mirror a real application's build sequence. Make iterates
 * this list; each entry becomes one blank Google Doc named `{label}`.
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

export interface GrantApprovalPayload {
  opportunityId: string;
  applicationId: string;
  opportunityName: string;
  fundingOrganization: string;
  applicantEntity: string;
  deadline: string | null;
  daysUntilDeadline: number | null;
  fundingAmount: number | null;
  applicationUrl: string | null;
  requiredDocuments: { type: string; label: string }[];
  draftDocs: string[];
  driveParentFolderId: string | null;
  callbackUrl: string;
}

/** Absolute URL Make posts the created Drive folder back to. */
function callbackUrl(): string {
  return `${env.APP_BASE_URL.replace(/\/$/, "")}/api/grantops/automation/callback`;
}

export function buildApprovalPayload(
  opp: FundingOpportunity,
  app: GrantApplication,
): GrantApprovalPayload {
  return {
    opportunityId: opp.id,
    applicationId: app.id,
    opportunityName: opp.opportunityName,
    fundingOrganization: opp.fundingOrganization,
    applicantEntity: app.applicantEntity,
    deadline: opp.deadline,
    daysUntilDeadline: daysUntil(opp.deadline),
    fundingAmount: opp.fundingAmount,
    applicationUrl: opp.applicationUrl ?? null,
    requiredDocuments: opp.requiredDocuments.map((dt) => ({
      type: dt,
      label: DOCUMENT_LABELS[dt] ?? dt,
    })),
    draftDocs: [...DRAFT_DOC_SECTIONS],
    driveParentFolderId: env.GRANTOPS_DRIVE_PARENT_FOLDER_ID ?? null,
    callbackUrl: callbackUrl(),
  };
}

/**
 * POST the approval to the Make.com webhook so Make builds the Drive workspace.
 * No-ops silently when unconfigured; never throws (best-effort, fire-and-forget).
 * Returns true only when the webhook accepted the payload.
 */
export async function fireGrantApprovalWebhook(
  opp: FundingOpportunity,
  app: GrantApplication,
): Promise<boolean> {
  const url = env.MAKE_GRANTOPS_WEBHOOK_URL;
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildApprovalPayload(opp, app)),
      cache: "no-store",
    });
    return res.ok;
  } catch (err) {
    console.error("[grantops] Make webhook failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Create the ClickUp deadline tasks for a freshly-approved grant: one "Submit"
 * task due on the deadline, plus one "Gather" task per required document. Best-effort
 * and individually guarded — ClickUp being unconfigured or a single task failing must
 * not abort the rest or the approval. Returns the count created.
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
