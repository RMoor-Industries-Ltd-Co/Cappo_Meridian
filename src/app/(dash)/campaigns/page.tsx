"use client";

import { useState } from "react";
import { Megaphone, TrendingUp } from "lucide-react";
import { DomainModule } from "@/components/modules/DomainModule";

const TABS = [
  {
    id: "marketing",
    label: "Marketing",
    icon: <Megaphone size={22} strokeWidth={1.75} />,
    domain: "Marketing",
    blurb: "Campaigns, content, and channels — ClickUp #marketing + Notion records.",
  },
  {
    id: "sales",
    label: "Sales",
    icon: <TrendingUp size={22} strokeWidth={1.75} />,
    domain: "Sales",
    blurb: "Pipeline and deals — ClickUp #sales + Notion records.",
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function CampaignsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("marketing");
  const tab = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  return (
    <div className="flex flex-col gap-6 pt-2">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gold">Campaigns</h1>
        <p className="mt-1 text-sm text-subtle">
          Marketing and Sales — campaigns, pipeline, content, and revenue.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 border-b border-border pb-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={[
              "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border border-b-0 transition-all",
              activeTab === t.id
                ? "border-border bg-panel text-gold border-gold/40"
                : "border-transparent text-subtle hover:text-fg hover:bg-panel/60",
            ].join(" ")}
          >
            <span className={activeTab === t.id ? "text-gold" : "text-subtle"}>
              {t.icon}
            </span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Active tab content */}
      <DomainModule
        domain={tab.domain}
        blurb={tab.blurb}
        icon={tab.icon}
      />
    </div>
  );
}
