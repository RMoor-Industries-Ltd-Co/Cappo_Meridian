"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Megaphone, TrendingUp, Flag } from "lucide-react";
import { DomainModule } from "@/components/modules/DomainModule";

const TABS = [
  {
    id: "marketing",
    label: "Marketing",
    icon: <Megaphone size={22} strokeWidth={1.75} />,
    blurb: "Campaigns, content, and channels — ClickUp #marketing + Notion records.",
  },
  {
    id: "sales",
    label: "Sales",
    icon: <TrendingUp size={22} strokeWidth={1.75} />,
    blurb: "Pipeline and deals — ClickUp #sales + Notion records.",
  },
  {
    id: "promotions",
    label: "Promotions",
    icon: <Flag size={22} strokeWidth={1.75} />,
    blurb: "Campaigns — the combined Marketing + Sales swim-lane view previously at /campaigns.",
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

/**
 * Commerce Operations — consolidates Marketing, Sales, and Promotions
 * (Campaigns) under one destination. Promotions recreates the former
 * standalone Campaigns page's combined Marketing+Sales view verbatim —
 * "Campaigns" remains a supported operational concept here, just relocated,
 * not deleted. `?tab=` supports the redirects from the old /campaigns,
 * /marketing, and /sales routes landing on the right tab.
 */
export function CommerceOperationsBoard() {
  const searchParams = useSearchParams();
  const fromQuery = searchParams.get("tab") as TabId | null;
  const queryTab = fromQuery && TABS.some((t) => t.id === fromQuery) ? fromQuery : null;

  // `override` wins once the user clicks a tab; before that, the `?tab=`
  // query param (set by the old /campaigns, /marketing, /sales redirects)
  // decides the initial tab. Deriving this at render time — rather than
  // syncing it via a `setState` call inside an effect — avoids the extra
  // cascading render that pattern would otherwise trigger.
  const [override, setOverride] = useState<TabId | null>(null);
  const activeTab = override ?? queryTab ?? "marketing";

  const tab = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div>
        <h1 className="text-2xl font-semibold text-gold">Commerce Operations</h1>
        <p className="mt-1 text-sm text-subtle">
          Marketing, Sales, and Promotions — campaigns, pipeline, content, and revenue.
        </p>
      </div>

      <div className="flex gap-2 border-b border-border pb-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setOverride(t.id)}
            className={[
              "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border border-b-0 transition-all",
              activeTab === t.id
                ? "border-border bg-panel text-gold border-gold/40"
                : "border-transparent text-subtle hover:text-fg hover:bg-panel/60",
            ].join(" ")}
          >
            <span className={activeTab === t.id ? "text-gold" : "text-subtle"}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {tab.id === "promotions" ? (
        <div className="flex flex-col gap-8">
          <p className="text-sm text-subtle">{tab.blurb}</p>
          <DomainModule
            domain="Marketing"
            blurb="Campaigns, content, and channels — ClickUp #marketing + Notion records."
            icon={<Megaphone size={22} strokeWidth={1.75} />}
          />
          <DomainModule
            domain="Sales"
            blurb="Pipeline and deals — ClickUp #sales + Notion records."
            icon={<TrendingUp size={22} strokeWidth={1.75} />}
          />
        </div>
      ) : (
        <DomainModule domain={tab.label} blurb={tab.blurb} icon={tab.icon} />
      )}
    </div>
  );
}
