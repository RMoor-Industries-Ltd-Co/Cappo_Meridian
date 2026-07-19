import { Card, SectionTitle } from "@/components/ui/Card";
import { listEntities } from "@/lib/grantops/store";
import { updateEntityAction } from "@/lib/grantops/actions";
import { Pill } from "@/components/grantops/badges";

export const dynamic = "force-dynamic";

const READINESS = ["ready", "in_progress", "not_started", "n_a"];
const READINESS_TONE: Record<string, "pos" | "warn" | "neg" | "neutral"> = {
  ready: "pos",
  in_progress: "warn",
  not_started: "neg",
  n_a: "neutral",
};

const sel = "rounded-md border border-border bg-panel-2 px-2 py-1 text-xs text-fg";

const READINESS_FIELDS: [string, string, (e: Record<string, unknown>) => string][] = [
  ["einStatus", "EIN", (e) => e.einStatus as string],
  ["stateRegistrationStatus", "State reg.", (e) => e.stateRegistrationStatus as string],
  ["operatingAgreementStatus", "Operating agmt.", (e) => e.operatingAgreementStatus as string],
  ["bankAccountStatus", "Bank account", (e) => e.bankAccountStatus as string],
  ["samGovStatus", "SAM.gov", (e) => e.samGovStatus as string],
  ["ueiStatus", "UEI", (e) => e.ueiStatus as string],
  ["grantsGovStatus", "Grants.gov", (e) => e.grantsGovStatus as string],
  ["mbeCertificationStatus", "MBE cert.", (e) => e.mbeCertificationStatus as string],
];

export default function EntitiesPage() {
  const entities = listEntities();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-subtle">
        Applicant profiles and funding-readiness. AMG coordinates; the operating entities and founders
        below are who actually applies. Keep registration status current so eligibility checks stay honest.
      </p>

      {entities.map((e) => (
        <Card key={e.id} className="p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-fg">{e.entityName}</h3>
            <Pill tone="gold">{e.entityCode}</Pill>
            <Pill tone="neutral">{e.entityType.replace(/_/g, " ")}</Pill>
            <Pill tone={e.fundingRole === "coordinator" ? "info" : "neutral"}>{e.fundingRole.replace(/_/g, " ")}</Pill>
          </div>
          <p className="mb-4 max-w-3xl text-sm text-muted">{e.description}</p>

          <form action={updateEntityAction} className="flex flex-col gap-3">
            <input type="hidden" name="id" value={e.id} />
            <SectionTitle title="Funding readiness" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {READINESS_FIELDS.map(([name, label, get]) => {
                const val = get(e as unknown as Record<string, unknown>);
                return (
                  <div key={name} className="flex flex-col gap-1 rounded-md border border-border bg-panel-2 p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-subtle">{label}</span>
                      <Pill tone={READINESS_TONE[val] ?? "neutral"}>{val.replace(/_/g, " ")}</Pill>
                    </div>
                    <select name={name} defaultValue={val} className={sel}>
                      {READINESS.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-subtle">Notes</label>
              <input name="notes" defaultValue={e.notes ?? ""} className="w-full rounded-md border border-border bg-panel-2 px-3 py-2 text-sm text-fg" />
            </div>
            <button className="btn-gold self-start rounded-md px-4 py-2 text-sm font-semibold">Save readiness</button>
          </form>
        </Card>
      ))}
    </div>
  );
}
