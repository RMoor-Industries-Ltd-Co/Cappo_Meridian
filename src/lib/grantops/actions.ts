"use server";

/**
 * GrantOps server actions — every mutation the UI performs.
 *
 * Nothing here ever contacts a third-party funder portal, submits an
 * application externally, or stores a credential. Submission is recorded only
 * AFTER a human has done it off-platform (recordSubmissionAction), and CAPPO
 * approval + human approval are explicit, human-triggered steps — that is the
 * human-in-the-loop guarantee the module is built around.
 */

import { revalidatePath } from "next/cache";
import {
  approveApplication,
  createApplication,
  createDocument,
  createOpportunity,
  getOpportunity,
  recordCappoDecision,
  recordSubmission,
  toggleChecklistItem,
  updateApplication,
  updateDocument,
  updateEntity,
  updateOpportunity,
} from "./store";
import { createDeadlineTasksForApplication, createDriveWorkspace } from "./automation";
import type {
  AwardType,
  CappoDecision,
  DocumentStatus,
  EntityCode,
  FundingOpportunity,
  GrantApplication,
  ProgramType,
} from "./types";

const B = "/grantops";

function num(v: FormDataEntryValue | null): number | undefined {
  if (v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function str(v: FormDataEntryValue | null): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? undefined : s;
}

export async function createOpportunityAction(form: FormData) {
  const name = str(form.get("opportunityName"));
  if (!name) return;
  createOpportunity({
    opportunityName: name,
    fundingOrganization: str(form.get("fundingOrganization")) ?? "",
    programType: (str(form.get("programType")) as ProgramType) ?? "grant",
    awardType: (str(form.get("awardType")) as AwardType) ?? "cash",
    deadline: str(form.get("deadline")) ?? null,
    rollingDeadline: form.get("rollingDeadline") === "on",
    fundingAmount: num(form.get("fundingAmount")) ?? null,
    bestApplicantEntity: (str(form.get("bestApplicantEntity")) as EntityCode) ?? "HVN",
    applicationUrl: str(form.get("applicationUrl")),
    sourceUrl: str(form.get("sourceUrl")),
    strategicFitScore: num(form.get("strategicFitScore")) ?? 5,
    urgencyScore: num(form.get("urgencyScore")) ?? 5,
    fundingValueScore: num(form.get("fundingValueScore")) ?? 5,
    probabilityScore: num(form.get("probabilityScore")) ?? 5,
    complexityDrag: num(form.get("complexityDrag")) ?? 3,
    allieNotes: str(form.get("allieNotes")),
    status: "scored",
  });
  revalidatePath(`${B}/opportunities`);
  revalidatePath(B);
}

export async function updateOpportunityScoresAction(form: FormData) {
  const id = str(form.get("id"));
  if (!id) return;
  const patch: Partial<FundingOpportunity> = {};
  const fit = num(form.get("strategicFitScore"));
  const urg = num(form.get("urgencyScore"));
  const val = num(form.get("fundingValueScore"));
  const prob = num(form.get("probabilityScore"));
  const drag = num(form.get("complexityDrag"));
  if (fit !== undefined) patch.strategicFitScore = fit;
  if (urg !== undefined) patch.urgencyScore = urg;
  if (val !== undefined) patch.fundingValueScore = val;
  if (prob !== undefined) patch.probabilityScore = prob;
  if (drag !== undefined) patch.complexityDrag = drag;
  const rec = str(form.get("recommendation"));
  if (rec) patch.recommendation = rec as FundingOpportunity["recommendation"];
  const owner = str(form.get("humanOwner"));
  if (owner) patch.humanOwner = owner as FundingOpportunity["humanOwner"];
  const allie = str(form.get("allieNotes"));
  if (allie !== undefined) patch.allieNotes = allie;
  updateOpportunity(id, patch);
  revalidatePath(`${B}/opportunities/${id}`);
  revalidatePath(`${B}/opportunities`);
  revalidatePath(`${B}/review`);
  revalidatePath(B);
}

export async function cappoDecisionAction(form: FormData) {
  const id = str(form.get("id"));
  const decision = str(form.get("decision")) as CappoDecision | undefined;
  if (!id || !decision) return;
  recordCappoDecision(id, decision, str(form.get("cappoNotes")));

  // Approval greenlight → scaffold the application automatically. Auto-open the
  // workspace (checklist), create the ClickUp deadline tasks, and create the Google
  // Drive folder + draft-doc workspace natively (linking the folder onto the app).
  // Guarded by automationFiredAt so a re-approval never double-scaffolds. All
  // best-effort: any integration being unconfigured/down never blocks the decision.
  if (decision === "approved_to_apply") {
    const opp = getOpportunity(id);
    const app = createApplication(id);
    if (opp && app && !app.automationFiredAt) {
      updateApplication(app.id, { automationFiredAt: new Date().toISOString() });
      await createDeadlineTasksForApplication(opp);
      await createDriveWorkspace(opp, app);
      revalidatePath(`${B}/applications`);
      revalidatePath(`${B}/applications/${app.id}`);
    }
  }

  revalidatePath(`${B}/review`);
  revalidatePath(`${B}/opportunities/${id}`);
  revalidatePath(B);
}

export async function openApplicationAction(form: FormData) {
  const oppId = str(form.get("opportunityId"));
  if (!oppId) return;
  const app = createApplication(oppId);
  revalidatePath(`${B}/applications`);
  revalidatePath(`${B}/opportunities/${oppId}`);
  if (app) revalidatePath(`${B}/applications/${app.id}`);
}

export async function updateApplicationAction(form: FormData) {
  const id = str(form.get("id"));
  if (!id) return;
  const patch: Partial<GrantApplication> = {};
  const status = str(form.get("applicationStatus"));
  if (status) patch.applicationStatus = status as GrantApplication["applicationStatus"];
  const drive = str(form.get("driveFolderUrl"));
  if (drive !== undefined) patch.driveFolderUrl = drive;
  for (const field of [
    "narrativeDraft", "founderBioDraft", "businessSummaryDraft", "projectSummaryDraft",
    "useOfFundsDraft", "budgetNarrativeDraft", "impactStatementDraft", "riskNotes",
    "complianceRequirements", "notes",
  ] as const) {
    const v = form.get(field);
    if (v !== null) (patch as Record<string, unknown>)[field] = typeof v === "string" ? v : "";
  }
  updateApplication(id, patch);
  revalidatePath(`${B}/applications/${id}`);
}

export async function toggleChecklistAction(form: FormData) {
  const id = str(form.get("id"));
  const documentType = str(form.get("documentType"));
  if (!id || !documentType) return;
  toggleChecklistItem(id, documentType, form.get("done") === "on");
  revalidatePath(`${B}/applications/${id}`);
}

export async function approveApplicationAction(form: FormData) {
  const id = str(form.get("id"));
  const approver = str(form.get("approvedBy")) as GrantApplication["approvedBy"];
  if (!id || !approver) return;
  approveApplication(id, approver);
  revalidatePath(`${B}/applications/${id}`);
}

export async function recordSubmissionAction(form: FormData) {
  const id = str(form.get("id"));
  const by = str(form.get("submittedBy")) as GrantApplication["submittedBy"];
  const confirmation = str(form.get("confirmationNumber"));
  if (!id || !by || !confirmation) return;
  recordSubmission(id, by, confirmation);
  revalidatePath(`${B}/applications/${id}`);
  revalidatePath(`${B}/applications`);
  revalidatePath(B);
}

export async function updateEntityAction(form: FormData) {
  const id = str(form.get("id"));
  if (!id) return;
  const patch: Record<string, unknown> = {};
  for (const field of [
    "einStatus", "stateRegistrationStatus", "operatingAgreementStatus", "bankAccountStatus",
    "samGovStatus", "ueiStatus", "grantsGovStatus", "mbeCertificationStatus",
  ] as const) {
    const v = str(form.get(field));
    if (v) patch[field] = v;
  }
  const notes = form.get("notes");
  if (notes !== null) patch.notes = typeof notes === "string" ? notes : "";
  updateEntity(id, patch);
  revalidatePath(`${B}/entities`);
}

export async function createDocumentAction(form: FormData) {
  const name = str(form.get("documentName"));
  if (!name) return;
  createDocument({
    documentName: name,
    documentType: (str(form.get("documentType")) as never) ?? "other",
    relatedEntity: (str(form.get("relatedEntity")) as EntityCode) ?? "AMG",
    status: (str(form.get("status")) as DocumentStatus) ?? "missing",
    fileUrl: str(form.get("fileUrl")),
    notes: str(form.get("notes")),
  });
  revalidatePath(`${B}/vault`);
}

export async function updateDocumentStatusAction(form: FormData) {
  const id = str(form.get("id"));
  const status = str(form.get("status")) as DocumentStatus | undefined;
  if (!id || !status) return;
  updateDocument(id, { status, fileUrl: str(form.get("fileUrl")) });
  revalidatePath(`${B}/vault`);
}
