import { Card, SectionTitle } from "@/components/ui/Card";
import { listDocuments } from "@/lib/grantops/store";
import { createDocumentAction, updateDocumentStatusAction } from "@/lib/grantops/actions";
import { Pill } from "@/components/grantops/badges";

export const dynamic = "force-dynamic";

const field = "w-full rounded-md border border-border bg-panel-2 px-3 py-2 text-sm text-fg placeholder:text-subtle focus:border-gold/50 focus:outline-none";
const labelCls = "mb-1 block text-xs uppercase tracking-wide text-subtle";

const STATUS_TONE: Record<string, "pos" | "warn" | "neg" | "info" | "neutral"> = {
  approved: "pos",
  uploaded: "info",
  draft: "warn",
  needs_update: "warn",
  expired: "neg",
  missing: "neg",
};

const ENTITIES = ["AMG", "HVN", "3E", "GovernanceIQ", "RMI", "RMG", "Rahmel", "Haneef", "Multiple"];
const DOC_TYPES = [
  "founder_bio", "business_summary", "ein_letter", "state_registration", "operating_agreement",
  "bank_proof", "naics_codes", "pitch_deck", "capability_statement", "forecast_12_month",
  "projection_3_year", "projection_5_year", "use_of_funds", "budget", "product_photos",
  "headshot", "tax_return", "ownership_proof", "minority_certification", "project_plan",
  "fiscal_sponsor_document", "other",
];
const DOC_STATUSES = ["missing", "draft", "uploaded", "approved", "expired", "needs_update"];

export default function VaultPage() {
  const docs = listDocuments();
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-subtle">
        Reusable application materials, tracked by readiness. Files live in Google Drive
        (the source of truth) — the vault stores links and status, never uploads or credentials.
      </p>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-subtle">
              <th className="px-4 py-3 font-medium">Document</th>
              <th className="px-4 py-3 font-medium">Entity</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Update</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3">
                  {d.fileUrl ? (
                    <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-fg hover:text-gold">{d.documentName}</a>
                  ) : (
                    <span className="font-medium text-fg">{d.documentName}</span>
                  )}
                  {d.notes && <div className="mt-0.5 text-xs text-subtle">{d.notes}</div>}
                </td>
                <td className="px-4 py-3 text-subtle">{d.relatedEntity}</td>
                <td className="px-4 py-3 text-subtle">{d.documentType.replace(/_/g, " ")}</td>
                <td className="px-4 py-3"><Pill tone={STATUS_TONE[d.status] ?? "neutral"}>{d.status.replace(/_/g, " ")}</Pill></td>
                <td className="px-4 py-3">
                  <form action={updateDocumentStatusAction} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={d.id} />
                    <select name="status" defaultValue={d.status} className="rounded-md border border-border bg-panel-2 px-2 py-1 text-xs text-fg">
                      {DOC_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                    </select>
                    <input name="fileUrl" defaultValue={d.fileUrl ?? ""} placeholder="Drive URL" className="w-32 rounded-md border border-border bg-panel-2 px-2 py-1 text-xs text-fg" />
                    <button className="rounded-md border border-gold/40 px-2 py-1 text-xs text-gold hover:bg-gold/10">Save</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="max-w-2xl p-5">
        <SectionTitle title="Add a document" />
        <form action={createDocumentAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>Document name *</label>
            <input name="documentName" required className={field} />
          </div>
          <div>
            <label className={labelCls}>Entity</label>
            <select name="relatedEntity" className={field} defaultValue="HVN">{ENTITIES.map((e) => <option key={e}>{e}</option>)}</select>
          </div>
          <div>
            <label className={labelCls}>Type</label>
            <select name="documentType" className={field} defaultValue="business_summary">{DOC_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}</select>
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select name="status" className={field} defaultValue="missing">{DOC_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select>
          </div>
          <div>
            <label className={labelCls}>Drive URL</label>
            <input name="fileUrl" type="url" className={field} placeholder="https://drive.google.com/…" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Notes</label>
            <input name="notes" className={field} />
          </div>
          <div className="sm:col-span-2">
            <button className="btn-gold rounded-md px-4 py-2 text-sm font-semibold">Add document</button>
          </div>
        </form>
      </Card>
    </div>
  );
}
