import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { createOpportunityAction } from "@/lib/grantops/actions";

export const dynamic = "force-dynamic";

const ENTITIES = ["AMG", "HVN", "3E", "GovernanceIQ", "RMI", "RMG", "Rahmel", "Haneef", "Multiple"];
const PROGRAM_TYPES = [
  "grant", "loan", "tax_credit", "accelerator", "pitch_competition",
  "certification", "technical_assistance", "contract", "in_kind_credit", "other",
];
const AWARD_TYPES = ["cash", "reimbursement", "credit", "in_kind", "loan", "equity", "contract"];

const field = "w-full rounded-md border border-border bg-panel-2 px-3 py-2 text-sm text-fg placeholder:text-subtle focus:border-gold/50 focus:outline-none";
const labelCls = "mb-1 block text-xs uppercase tracking-wide text-subtle";

export default function NewOpportunityPage() {
  async function submit(form: FormData) {
    "use server";
    await createOpportunityAction(form);
    redirect("/grantops/opportunities");
  }

  return (
    <Card className="max-w-3xl p-6">
      <h2 className="mb-1 text-lg font-semibold text-fg">Add a funding opportunity</h2>
      <p className="mb-5 text-sm text-subtle">
        Enter what you know. Leave eligibility unknowns for ALLIE to verify — the module
        never assumes eligibility. Scores default to 5 and feed the priority formula.
      </p>
      <form action={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls}>Opportunity name *</label>
          <input name="opportunityName" required className={field} placeholder="e.g. The Big Skip Summer Grant" />
        </div>
        <div>
          <label className={labelCls}>Funding organization</label>
          <input name="fundingOrganization" className={field} />
        </div>
        <div>
          <label className={labelCls}>Best applicant entity</label>
          <select name="bestApplicantEntity" className={field} defaultValue="HVN">
            {ENTITIES.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Program type</label>
          <select name="programType" className={field} defaultValue="grant">
            {PROGRAM_TYPES.map((p) => <option key={p} value={p}>{p.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Award type</label>
          <select name="awardType" className={field} defaultValue="cash">
            {AWARD_TYPES.map((a) => <option key={a} value={a}>{a.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Funding amount (USD)</label>
          <input name="fundingAmount" type="number" min="0" className={field} placeholder="10000" />
        </div>
        <div>
          <label className={labelCls}>Deadline (ISO date)</label>
          <input name="deadline" type="date" className={field} />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <input id="rolling" name="rollingDeadline" type="checkbox" className="accent-[var(--gold)]" />
          <label htmlFor="rolling" className="text-sm text-subtle">Rolling deadline</label>
        </div>
        <div>
          <label className={labelCls}>Application URL</label>
          <input name="applicationUrl" type="url" className={field} placeholder="https://" />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Source URL</label>
          <input name="sourceUrl" type="url" className={field} placeholder="https://" />
        </div>

        <div className="sm:col-span-2 mt-2 grid grid-cols-2 gap-4 sm:grid-cols-5">
          {[
            ["strategicFitScore", "Fit"],
            ["urgencyScore", "Urgency"],
            ["fundingValueScore", "Value"],
            ["probabilityScore", "Probability"],
            ["complexityDrag", "Complexity drag"],
          ].map(([name, label]) => (
            <div key={name}>
              <label className={labelCls}>{label}</label>
              <input name={name} type="number" min="0" max="10" defaultValue={name === "complexityDrag" ? 3 : 5} className={field} />
            </div>
          ))}
        </div>

        <div className="sm:col-span-2">
          <label className={labelCls}>ALLIE notes</label>
          <textarea name="allieNotes" rows={3} className={field} placeholder="What to verify, why it fits, caveats…" />
        </div>

        <div className="sm:col-span-2 flex items-center gap-3">
          <button type="submit" className="btn-gold rounded-md px-4 py-2 text-sm font-semibold">Add opportunity</button>
          <Link href="/grantops/opportunities" className="text-sm text-subtle hover:text-fg">Cancel</Link>
        </div>
      </form>
    </Card>
  );
}
