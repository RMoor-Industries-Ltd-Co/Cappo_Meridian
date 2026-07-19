import type { RiskFlag } from "@/lib/grantops/types";

/** Small pill used across GrantOps. */
export function Pill({
  children,
  tone = "neutral",
  title,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "gold" | "pos" | "neg" | "warn" | "info";
  title?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "border-border text-subtle",
    gold: "border-gold/40 text-gold",
    pos: "border-pos/40 text-pos",
    neg: "border-neg/40 text-neg",
    warn: "border-amber-500/40 text-amber-400",
    info: "border-sky-500/40 text-sky-400",
  };
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

const RECOMMENDATION_TONE: Record<string, "pos" | "warn" | "info" | "neg"> = {
  apply_now: "pos",
  verify_first: "warn",
  watchlist: "info",
  reject: "neg",
};
const RECOMMENDATION_LABEL: Record<string, string> = {
  apply_now: "Apply Now",
  verify_first: "Verify First",
  watchlist: "Watchlist",
  reject: "Reject",
};

export function RecommendationBadge({ value }: { value: string }) {
  return <Pill tone={RECOMMENDATION_TONE[value] ?? "neutral"}>{RECOMMENDATION_LABEL[value] ?? value}</Pill>;
}

const CAPPO_TONE: Record<string, "pos" | "warn" | "info" | "neg" | "neutral"> = {
  pending: "neutral",
  approved_to_apply: "pos",
  rejected: "neg",
  deferred: "info",
  more_info_needed: "warn",
};
const CAPPO_LABEL: Record<string, string> = {
  pending: "CAPPO: Pending",
  approved_to_apply: "CAPPO: Approved",
  rejected: "CAPPO: Rejected",
  deferred: "CAPPO: Deferred",
  more_info_needed: "CAPPO: More info",
};

export function CappoBadge({ value }: { value: string }) {
  return <Pill tone={CAPPO_TONE[value] ?? "neutral"}>{CAPPO_LABEL[value] ?? value}</Pill>;
}

export function RiskFlags({ flags }: { flags: RiskFlag[] }) {
  if (flags.length === 0) return <Pill tone="pos">No blockers flagged</Pill>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {flags.map((f) => (
        <Pill key={f.key} tone={f.severity === "block" ? "neg" : f.severity === "warn" ? "warn" : "info"} title={f.severity}>
          {f.label}
        </Pill>
      ))}
    </div>
  );
}

const TRISTATE_LABEL: Record<string, string> = {
  yes: "Yes",
  no: "No",
  verify: "Verify",
  not_applicable: "N/A",
};

export function TriStatePill({ value }: { value: string }) {
  const tone = value === "yes" ? "pos" : value === "no" ? "neutral" : value === "verify" ? "warn" : "neutral";
  return <Pill tone={tone as "pos" | "neutral" | "warn"}>{TRISTATE_LABEL[value] ?? value}</Pill>;
}

/** Currency formatter that renders in-kind/credit awards as a label, not $0. */
export function money(amount: number | null): string {
  if (amount === null) return "In-kind / TBD";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

export function deadlineLabel(deadline: string | null, days: number | null): string {
  if (!deadline) return "Rolling";
  if (days === null) return deadline;
  if (days < 0) return `${deadline} (past)`;
  if (days === 0) return `${deadline} (today)`;
  return `${deadline} · ${days}d`;
}
